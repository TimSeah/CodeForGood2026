import { caseWeekday, formatCaseDate, formatTime12 } from "@/lib/dates";
import type { ChangeReasonCode, PreferenceEvidence, PreferenceStatus, PreferenceType } from "@/lib/types";

// PURE pattern detection over admin change events. Produces SUGGESTIONS only — never active rules.

export const PREFERENCE_CONFIG = {
  /** Similar admin changes, on separate dates, before a preference is suggested. */
  suggestionThreshold: Number(process.env.PREFERENCE_SUGGESTION_THRESHOLD) || 3,
};

/** Reason codes that count as evidence for each preference type. Other reasons are recorded but never learned from. */
export const EVIDENCE_REASON: Record<PreferenceType, ChangeReasonCode> = {
  pairing: "child_incompatible",
  time_unavailable: "therapist_time_unavailable",
};

export const pairingSignature = (therapistId: number, studentId: number) => `pairing:${therapistId}:${studentId}`;
export const timeSignature = (therapistId: number) => `time:${therapistId}`;

export interface ExistingPreference {
  signature: string;
  status: PreferenceStatus;
  /** removed only: newest change event id at removal time. */
  removedAfterEventId: number | null;
}

export interface DetectedSuggestion {
  type: PreferenceType;
  signature: string;
  therapistId: number;
  studentId: number | null;
  /** Default strength offered to the admin; they choose the final one when confirming. */
  strength: "soft" | "hard";
  /** time only: weekdays seen in the evidence — a starting point the admin must confirm. */
  days: number[] | null;
  evidenceEventIds: number[];
  question: string;
}

/**
 * - Counts distinct DATES, not edits (two edits on the same day are one piece of evidence).
 * - Reason-less events are never evidence (callers pass only reason-coded events; we re-check).
 * - Never suggests a signature the admin already has as active/paused, or REJECTED.
 * - After a rule is REMOVED, only evidence recorded after the removal counts towards a new suggestion.
 * - An existing open suggestion is returned again (with fresh evidence) so the service can update it.
 */
export function detectSuggestions(
  events: PreferenceEvidence[],
  existing: ExistingPreference[],
  threshold = PREFERENCE_CONFIG.suggestionThreshold,
): DetectedSuggestion[] {
  const blocked = new Set(
    existing.filter((p) => ["active", "paused", "rejected"].includes(p.status)).map((p) => p.signature),
  );
  const removedAfter = new Map<string, number>();
  for (const p of existing.filter((x) => x.status === "removed")) {
    removedAfter.set(p.signature, Math.max(removedAfter.get(p.signature) ?? 0, p.removedAfterEventId ?? 0));
  }

  const groups = new Map<string, { type: PreferenceType; therapistId: number; studentId: number | null; events: PreferenceEvidence[] }>();
  for (const e of events) {
    let key: string;
    let type: PreferenceType;
    if (e.reasonCode === EVIDENCE_REASON.pairing) {
      key = pairingSignature(e.removedTherapistId, e.studentId);
      type = "pairing";
    } else if (e.reasonCode === EVIDENCE_REASON.time_unavailable) {
      key = timeSignature(e.removedTherapistId);
      type = "time_unavailable";
    } else continue;
    if (blocked.has(key)) continue;
    if (removedAfter.has(key) && e.eventId <= removedAfter.get(key)!) continue;
    if (!groups.has(key)) {
      groups.set(key, { type, therapistId: e.removedTherapistId, studentId: type === "pairing" ? e.studentId : null, events: [] });
    }
    groups.get(key)!.events.push(e);
  }

  const out: DetectedSuggestion[] = [];
  for (const [signature, g] of groups) {
    const dates = [...new Set(g.events.map((e) => e.date))].sort();
    if (dates.length < threshold) continue;
    const therapist = g.events[0].removedTherapistName;
    const datesText = dates.map(formatCaseDate).join(", ");

    if (g.type === "pairing") {
      const child = g.events[0].studentName;
      out.push({
        type: "pairing",
        signature,
        therapistId: g.therapistId,
        studentId: g.studentId,
        strength: "soft",
        days: null,
        evidenceEventIds: g.events.map((e) => e.eventId),
        question: `I noticed ${therapist} was replaced for ${child} on ${dates.length} separate dates (${datesText}) because they weren't compatible. Should I avoid this pairing in future schedules?`,
      });
    } else {
      const sessions = [...new Map(g.events.map((e) => [e.date, e])).values()]
        .sort((a, b) => a.date.localeCompare(b.date))
        .map((e) => `${formatCaseDate(e.date)} ${formatTime12(e.startTime)}–${formatTime12(e.endTime)}`)
        .join("; ");
      out.push({
        type: "time_unavailable",
        signature,
        therapistId: g.therapistId,
        studentId: null,
        strength: "hard",
        days: [...new Set(dates.map(caseWeekday))].sort(),
        evidenceEventIds: g.events.map((e) => e.eventId),
        question: `I noticed ${therapist} was taken off sessions on ${dates.length} separate dates because the time didn't work for them (${sessions}). Is this an ongoing unavailability? If so, confirm the exact cut-off time, whether it applies to the session's start or end, which days, and until when.`,
      });
    }
  }
  return out;
}
