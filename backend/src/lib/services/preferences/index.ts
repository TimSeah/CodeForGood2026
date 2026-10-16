import { getDb } from "@/lib/db/client";
import { HttpError } from "@/lib/http";
import { logAudit } from "@/lib/repositories/audit";
import { insertChangeEvent, listChangeEventsByIds, listChangeEventsByReason } from "@/lib/repositories/change-events";
import {
  getPreferenceRecord,
  insertPreference,
  listPreferenceRecords,
  markPreferenceRemoved,
  type PreferenceFields,
  type PreferenceRecord,
  setPreferenceEvidence,
  setPreferenceStatus,
  updatePreferenceFields,
} from "@/lib/repositories/preferences";
import { listStudents } from "@/lib/repositories/students";
import { listTherapists } from "@/lib/repositories/therapists";
import type { ChangeReason, PlanAssignment, PreferenceStatus, SchedulingPreference } from "@/lib/types";
import { summarizePreference } from "../reallocation/preferences";
import { detectPersistentPreference } from "./agent-intent";
import { detectSuggestions, EVIDENCE_REASON, pairingSignature, PREFERENCE_CONFIG, timeSignature } from "./detect";

// Admin-confirmed scheduling preference memory. Rules:
// - Suggestions (status "suggested") never affect scheduling; only "active" preferences do.
// - Nothing becomes active without an explicit admin action (confirm / create).
// - Every creation, suggestion, confirmation, rejection, edit, pause, resume and removal is audited.

/** API shape: internal bookkeeping (signature, ids, removal cutoff) stays server-side. */
function decorate(r: PreferenceRecord): SchedulingPreference {
  const { signature: _s, evidenceEventIds, removedAfterEventId: _r, ...rest } = r;
  return { ...rest, summary: summarizePreference(r), evidence: listChangeEventsByIds(evidenceEventIds) };
}

export function listPreferences(statuses?: PreferenceStatus[]): SchedulingPreference[] {
  return listPreferenceRecords(statuses).map(decorate);
}

export function getPreferenceOrThrow(id: number): SchedulingPreference {
  const r = getPreferenceRecord(id);
  if (!r) throw new HttpError(404, `Preference ${id} not found`);
  return decorate(r);
}

// ---- evidence capture ---------------------------------------------------------------------------

/**
 * Records that an admin moved a PROPOSED therapist off a draft assignment, with the admin's reason (if given),
 * then looks for repeated patterns. Changes without a reason are stored for traceability but never used as
 * evidence. Returns the new/updated suggestions so the caller can surface them.
 */
export function recordAssignmentChange(input: {
  planId: number;
  date: string;
  assignment: PlanAssignment; // state BEFORE the change
  newTherapistId: number | null;
  action: "edited" | "rejected";
  reason?: ChangeReason | null;
  actor: string;
}): SchedulingPreference[] {
  const a = input.assignment;
  if (a.toTherapistId === null || a.toTherapistId === input.newTherapistId) return [];
  const eventId = insertChangeEvent({
    planId: input.planId,
    planAssignmentId: a.id,
    sessionId: a.sessionId,
    date: input.date,
    slot: a.slot,
    startTime: a.startTime,
    endTime: a.endTime,
    studentId: a.studentId,
    removedTherapistId: a.toTherapistId,
    newTherapistId: input.newTherapistId,
    action: input.action,
    reasonCode: input.reason?.code ?? null,
    reasonNote: input.reason?.note?.trim() || null,
    actor: input.actor,
  });
  logAudit({
    actor: input.actor,
    action: "preference_evidence.recorded",
    entityType: "assignment_change_event",
    entityId: eventId,
    details: { assignmentId: a.id, removed: a.toTherapistId, to: input.newTherapistId, reason: input.reason ?? null },
  });
  return input.reason ? refreshSuggestions(input.actor) : [];
}

/** Runs pattern detection and stores new suggestions (or refreshes open ones). */
export function refreshSuggestions(actor: string): SchedulingPreference[] {
  const events = listChangeEventsByReason([EVIDENCE_REASON.pairing, EVIDENCE_REASON.time_unavailable]);
  const existing = listPreferenceRecords();
  const detected = detectSuggestions(events, existing, PREFERENCE_CONFIG.suggestionThreshold);
  const touched: number[] = [];

  for (const d of detected) {
    const open = existing.find((p) => p.signature === d.signature && p.status === "suggested");
    if (open) {
      const merged = [...new Set([...open.evidenceEventIds, ...d.evidenceEventIds])];
      if (merged.length === open.evidenceEventIds.length) continue;
      setPreferenceEvidence(open.id, merged, d.question);
      logAudit({ actor, action: "preference.suggestion_updated", entityType: "preference", entityId: open.id, details: { evidenceEventIds: merged } });
      touched.push(open.id);
      continue;
    }
    const id = insertPreference({
      type: d.type,
      therapistId: d.therapistId,
      studentId: d.studentId,
      strength: d.strength,
      status: "suggested",
      source: "pattern",
      days: d.days,
      boundaryTime: null, // the admin must state the exact time
      appliesTo: null,
      effectiveFrom: null,
      effectiveTo: null,
      reason: null,
      question: d.question,
      signature: d.signature,
      evidenceEventIds: d.evidenceEventIds,
      agentPrompt: null,
      confirmedBy: null,
      createdBy: "system",
    });
    logAudit({ actor: "system", action: "preference.suggested", entityType: "preference", entityId: id, details: { signature: d.signature, evidenceEventIds: d.evidenceEventIds, triggeredBy: actor } });
    touched.push(id);
  }
  return touched.map(getPreferenceOrThrow);
}

/**
 * An AI-agent instruction that sounds like a lasting rule becomes a SUGGESTION with a confirmation question.
 * The agent itself only applies the instruction to the current draft.
 */
export function suggestFromAgentPrompt(prompt: string, actor: string): SchedulingPreference | null {
  const intent = detectPersistentPreference(prompt, listTherapists(), listStudents());
  if (!intent) return null;
  const signature =
    intent.type === "pairing" ? pairingSignature(intent.therapistId, intent.studentId!) : timeSignature(intent.therapistId);
  if (listPreferenceRecords().some((p) => p.signature === signature && p.status !== "removed")) return null;

  const draft = summarizePreference({
    ...intent,
    therapistName: listTherapists().find((t) => t.id === intent.therapistId)!.name,
    studentName: intent.studentId ? (listStudents().find((s) => s.id === intent.studentId)?.name ?? null) : null,
    appliesTo: intent.type === "time_unavailable" ? "end" : null,
    effectiveFrom: null,
    effectiveTo: null,
  });
  const question =
    intent.type === "pairing"
      ? `Your instruction to the AI agent sounded like a lasting rule: “${prompt.trim()}”. It was applied to this draft only. Should I save it for future schedules (${draft.charAt(0).toLowerCase()}${draft.slice(1)})?`
      : `Your instruction to the AI agent sounded like a lasting time restriction: “${prompt.trim()}”. It was applied to this draft only. To save it, confirm the exact time, whether it applies to the session's start or end, the days, and whether it's ongoing.`;
  const id = insertPreference({
    type: intent.type,
    therapistId: intent.therapistId,
    studentId: intent.studentId,
    strength: intent.strength,
    status: "suggested",
    source: "agent_prompt",
    days: intent.days,
    boundaryTime: intent.boundaryTime,
    appliesTo: null, // never guessed: the admin chooses start or end
    effectiveFrom: null,
    effectiveTo: null,
    reason: null,
    question,
    signature,
    evidenceEventIds: [],
    agentPrompt: prompt.trim(),
    confirmedBy: null,
    createdBy: actor,
  });
  logAudit({ actor, action: "preference.suggested", entityType: "preference", entityId: id, details: { source: "agent_prompt", prompt } });
  return getPreferenceOrThrow(id);
}

// ---- admin decisions ----------------------------------------------------------------------------

export interface PreferenceInput {
  strength: "soft" | "hard";
  days?: number[] | null;
  boundaryTime?: string | null;
  appliesTo?: "start" | "end" | null;
  /** time rules: true = no end date. */
  ongoing?: boolean;
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
  reason?: string | null;
}

/** Normalises and checks fields for a preference of this type. Time rules need explicit days, time and start/end. */
function toFields(type: SchedulingPreference["type"], input: PreferenceInput): PreferenceFields {
  const effectiveTo = input.ongoing ? null : (input.effectiveTo ?? null);
  const effectiveFrom = input.effectiveFrom ?? null;
  if (effectiveFrom && effectiveTo && effectiveTo < effectiveFrom) throw new HttpError(400, "The end date is before the start date");
  if (type === "pairing") {
    return { strength: input.strength, days: null, boundaryTime: null, appliesTo: null, effectiveFrom, effectiveTo, reason: input.reason?.trim() || null };
  }
  if (!input.days?.length || !input.boundaryTime || !input.appliesTo) {
    throw new HttpError(400, "A time rule needs explicit days, an exact time, and whether it applies to the session's start or end");
  }
  if (input.ongoing === undefined && input.effectiveTo === undefined) {
    throw new HttpError(400, "Say whether the time rule is ongoing or give an end date");
  }
  if (input.ongoing === false && !effectiveTo) throw new HttpError(400, "A time rule that isn't ongoing needs an end date");
  return {
    strength: input.strength,
    days: [...new Set(input.days)].sort(),
    boundaryTime: input.boundaryTime,
    appliesTo: input.appliesTo,
    effectiveFrom,
    effectiveTo,
    reason: input.reason?.trim() || null,
  };
}

/** Admin adds a rule directly (no suggestion needed). Active immediately — the admin is the confirmer. */
export function createPreference(
  input: PreferenceInput & { type: SchedulingPreference["type"]; therapistId: number; studentId?: number | null },
  actor: string,
): SchedulingPreference {
  if (!listTherapists().some((t) => t.id === input.therapistId)) throw new HttpError(404, `Therapist ${input.therapistId} not found`);
  if (input.type === "pairing" && !listStudents().some((s) => s.id === input.studentId)) {
    throw new HttpError(400, "A pairing rule needs a child");
  }
  const signature = input.type === "pairing" ? pairingSignature(input.therapistId, input.studentId!) : timeSignature(input.therapistId);
  const clash = listPreferenceRecords(["active", "paused"]).find((p) => p.signature === signature);
  if (clash) throw new HttpError(409, `A rule for this already exists (#${clash.id}) — edit that one instead`);

  const fields = toFields(input.type, input);
  const id = getDb().transaction(() => {
    const id = insertPreference({
      ...fields,
      type: input.type,
      therapistId: input.therapistId,
      studentId: input.type === "pairing" ? input.studentId! : null,
      status: "active",
      source: "admin",
      question: null,
      signature,
      evidenceEventIds: [],
      agentPrompt: null,
      confirmedBy: actor,
      createdBy: actor,
    });
    logAudit({ actor, action: "preference.created", entityType: "preference", entityId: id, details: { type: input.type, ...fields } });
    return id;
  })();
  return getPreferenceOrThrow(id);
}

function requireStatus(p: SchedulingPreference, allowed: PreferenceStatus[], verb: string) {
  if (!allowed.includes(p.status)) throw new HttpError(409, `Can't ${verb} a preference that is ${p.status}`);
}

/** Suggestion → active rule, with the admin's final choices (strength; for time rules: exact time, start/end, days, dates). */
export function confirmPreference(id: number, input: PreferenceInput, actor: string): SchedulingPreference {
  const p = getPreferenceOrThrow(id);
  requireStatus(p, ["suggested"], "confirm");
  const fields = toFields(p.type, input);
  getDb().transaction(() => {
    updatePreferenceFields(id, fields);
    setPreferenceStatus(id, "active", actor);
    logAudit({ actor, action: "preference.confirmed", entityType: "preference", entityId: id, details: fields });
  })();
  return getPreferenceOrThrow(id);
}

/** "Not a rule". The same pattern won't be suggested again. */
export function rejectPreference(id: number, reason: string | null | undefined, actor: string): SchedulingPreference {
  const p = getPreferenceOrThrow(id);
  requireStatus(p, ["suggested"], "reject");
  getDb().transaction(() => {
    if (reason?.trim()) updatePreferenceFields(id, { ...p, reason: reason.trim() });
    setPreferenceStatus(id, "rejected");
    logAudit({ actor, action: "preference.rejected", entityType: "preference", entityId: id, details: { reason: reason ?? null } });
  })();
  return getPreferenceOrThrow(id);
}

export function editPreference(id: number, input: PreferenceInput, actor: string): SchedulingPreference {
  const before = getPreferenceOrThrow(id);
  requireStatus(before, ["active", "paused"], "edit");
  // Fields not sent keep their current value (including "ongoing" for time rules).
  const merged: PreferenceInput = {
    days: before.days,
    boundaryTime: before.boundaryTime,
    appliesTo: before.appliesTo,
    effectiveFrom: before.effectiveFrom,
    reason: before.reason,
    ...input,
  };
  if (input.ongoing === undefined && input.effectiveTo === undefined) {
    merged.ongoing = before.effectiveTo === null;
    merged.effectiveTo = before.effectiveTo;
  }
  const fields = toFields(before.type, merged);
  getDb().transaction(() => {
    updatePreferenceFields(id, fields);
    logAudit({
      actor,
      action: "preference.edited",
      entityType: "preference",
      entityId: id,
      details: {
        before: {
          strength: before.strength,
          days: before.days,
          boundaryTime: before.boundaryTime,
          appliesTo: before.appliesTo,
          effectiveFrom: before.effectiveFrom,
          effectiveTo: before.effectiveTo,
          reason: before.reason,
        },
        after: fields,
      },
    });
  })();
  return getPreferenceOrThrow(id);
}

export function pausePreference(id: number, actor: string): SchedulingPreference {
  requireStatus(getPreferenceOrThrow(id), ["active"], "pause");
  getDb().transaction(() => {
    setPreferenceStatus(id, "paused");
    logAudit({ actor, action: "preference.paused", entityType: "preference", entityId: id });
  })();
  return getPreferenceOrThrow(id);
}

export function resumePreference(id: number, actor: string): SchedulingPreference {
  requireStatus(getPreferenceOrThrow(id), ["paused"], "resume");
  getDb().transaction(() => {
    setPreferenceStatus(id, "active");
    logAudit({ actor, action: "preference.resumed", entityType: "preference", entityId: id });
  })();
  return getPreferenceOrThrow(id);
}

/** Soft delete: kept (status "removed") for the audit trail; it no longer applies. */
export function removePreference(id: number, actor: string): SchedulingPreference {
  requireStatus(getPreferenceOrThrow(id), ["active", "paused"], "remove");
  getDb().transaction(() => {
    markPreferenceRemoved(id);
    logAudit({ actor, action: "preference.removed", entityType: "preference", entityId: id });
  })();
  return getPreferenceOrThrow(id);
}
