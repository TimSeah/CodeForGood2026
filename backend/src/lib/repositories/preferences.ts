import { getDb } from "@/lib/db/client";
import type {
  PreferenceSource,
  PreferenceStatus,
  PreferenceStrength,
  PreferenceType,
  SchedulingPreference,
  TimeBoundaryAppliesTo,
} from "@/lib/types";

/** A preference row with names but without the derived `summary` / expanded `evidence` (services add those). */
export type PreferenceRecord = Omit<SchedulingPreference, "summary" | "evidence"> & {
  signature: string;
  evidenceEventIds: number[];
  /** Set when removed: only change events with a higher id may lead to a new suggestion. */
  removedAfterEventId: number | null;
};

interface PreferenceRow {
  id: number;
  type: PreferenceType;
  therapist_id: number;
  therapist_name: string;
  student_id: number | null;
  student_name: string | null;
  strength: PreferenceStrength;
  status: PreferenceStatus;
  source: PreferenceSource;
  days: string | null;
  boundary_time: string | null;
  applies_to: TimeBoundaryAppliesTo | null;
  effective_from: string | null;
  effective_to: string | null;
  reason: string | null;
  question: string | null;
  signature: string;
  evidence_event_ids: string;
  removed_after_event_id: number | null;
  agent_prompt: string | null;
  confirmed_by: string | null;
  confirmed_at: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

const SELECT = `
  SELECT p.*, t.name AS therapist_name, s.name AS student_name
  FROM scheduling_preferences p
  JOIN therapists t ON t.id = p.therapist_id
  LEFT JOIN students s ON s.id = p.student_id`;

const toRecord = (r: PreferenceRow): PreferenceRecord => ({
  id: r.id,
  type: r.type,
  therapistId: r.therapist_id,
  therapistName: r.therapist_name,
  studentId: r.student_id,
  studentName: r.student_name,
  strength: r.strength,
  status: r.status,
  source: r.source,
  days: r.days ? (JSON.parse(r.days) as number[]) : null,
  boundaryTime: r.boundary_time,
  appliesTo: r.applies_to,
  effectiveFrom: r.effective_from,
  effectiveTo: r.effective_to,
  reason: r.reason,
  question: r.question,
  agentPrompt: r.agent_prompt,
  confirmedBy: r.confirmed_by,
  confirmedAt: r.confirmed_at,
  createdBy: r.created_by,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
  signature: r.signature,
  evidenceEventIds: JSON.parse(r.evidence_event_ids) as number[],
  removedAfterEventId: r.removed_after_event_id,
});

export function listPreferenceRecords(statuses?: PreferenceStatus[]): PreferenceRecord[] {
  const where = statuses?.length ? `WHERE p.status IN (${statuses.map(() => "?").join(", ")})` : "";
  const rows = getDb()
    .prepare(`${SELECT} ${where} ORDER BY p.updated_at DESC, p.id DESC`)
    .all(...(statuses ?? [])) as PreferenceRow[];
  return rows.map(toRecord);
}

export function getPreferenceRecord(id: number): PreferenceRecord | null {
  const row = getDb().prepare(`${SELECT} WHERE p.id = ?`).get(id) as PreferenceRow | undefined;
  return row ? toRecord(row) : null;
}

/** The editable fields of a preference (everything except identity, audit timestamps and names). */
export interface PreferenceFields {
  strength: PreferenceStrength;
  days: number[] | null;
  boundaryTime: string | null;
  appliesTo: TimeBoundaryAppliesTo | null;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  reason: string | null;
}

export function insertPreference(
  input: PreferenceFields & {
    type: PreferenceType;
    therapistId: number;
    studentId: number | null;
    status: PreferenceStatus;
    source: PreferenceSource;
    question: string | null;
    signature: string;
    evidenceEventIds: number[];
    agentPrompt: string | null;
    confirmedBy: string | null;
    createdBy: string;
  },
): number {
  const r = getDb()
    .prepare(
      `INSERT INTO scheduling_preferences
       (type, therapist_id, student_id, strength, status, source, days, boundary_time, applies_to, effective_from,
        effective_to, reason, question, signature, evidence_event_ids, agent_prompt, confirmed_by, confirmed_at, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CASE WHEN ? IS NULL THEN NULL ELSE datetime('now') END, ?)`,
    )
    .run(
      input.type,
      input.therapistId,
      input.studentId,
      input.strength,
      input.status,
      input.source,
      input.days ? JSON.stringify(input.days) : null,
      input.boundaryTime,
      input.appliesTo,
      input.effectiveFrom,
      input.effectiveTo,
      input.reason,
      input.question,
      input.signature,
      JSON.stringify(input.evidenceEventIds),
      input.agentPrompt,
      input.confirmedBy,
      input.confirmedBy,
      input.createdBy,
    );
  return Number(r.lastInsertRowid);
}

export function updatePreferenceFields(id: number, f: PreferenceFields) {
  getDb()
    .prepare(
      `UPDATE scheduling_preferences SET strength = ?, days = ?, boundary_time = ?, applies_to = ?, effective_from = ?,
       effective_to = ?, reason = ?, updated_at = datetime('now') WHERE id = ?`,
    )
    .run(
      f.strength,
      f.days ? JSON.stringify(f.days) : null,
      f.boundaryTime,
      f.appliesTo,
      f.effectiveFrom,
      f.effectiveTo,
      f.reason,
      id,
    );
}

/** Changes status; `confirmedBy` stamps confirmed_by / confirmed_at (used when a suggestion becomes active). */
export function setPreferenceStatus(id: number, status: PreferenceStatus, confirmedBy?: string) {
  getDb()
    .prepare(
      `UPDATE scheduling_preferences SET status = ?, updated_at = datetime('now'),
       confirmed_by = COALESCE(?, confirmed_by),
       confirmed_at = CASE WHEN ? IS NULL THEN confirmed_at ELSE datetime('now') END
       WHERE id = ?`,
    )
    .run(status, confirmedBy ?? null, confirmedBy ?? null, id);
}

/** Status → removed, remembering the newest change event so older evidence can't re-suggest it. */
export function markPreferenceRemoved(id: number) {
  getDb()
    .prepare(
      `UPDATE scheduling_preferences SET status = 'removed', updated_at = datetime('now'),
       removed_after_event_id = (SELECT COALESCE(MAX(id), 0) FROM assignment_change_events) WHERE id = ?`,
    )
    .run(id);
}

export function setPreferenceEvidence(id: number, evidenceEventIds: number[], question: string | null) {
  getDb()
    .prepare(
      "UPDATE scheduling_preferences SET evidence_event_ids = ?, question = ?, updated_at = datetime('now') WHERE id = ?",
    )
    .run(JSON.stringify(evidenceEventIds), question, id);
}
