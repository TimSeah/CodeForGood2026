import { getDb } from "@/lib/db/client";
import type { ChangeReasonCode, PreferenceEvidence, Slot } from "@/lib/types";

interface ChangeEventRow {
  id: number;
  date: string;
  slot: Slot;
  start_time: string;
  end_time: string;
  student_id: number;
  student_name: string;
  removed_therapist_id: number;
  removed_therapist_name: string;
  new_therapist_name: string | null;
  action: PreferenceEvidence["action"];
  reason_code: ChangeReasonCode | null;
  reason_note: string | null;
  actor: string;
  created_at: string;
}

const SELECT = `
  SELECT e.*, s.name AS student_name, rt.name AS removed_therapist_name, nt.name AS new_therapist_name
  FROM assignment_change_events e
  JOIN students s ON s.id = e.student_id
  JOIN therapists rt ON rt.id = e.removed_therapist_id
  LEFT JOIN therapists nt ON nt.id = e.new_therapist_id`;

const toEvidence = (r: ChangeEventRow): PreferenceEvidence => ({
  eventId: r.id,
  date: r.date,
  slot: r.slot,
  startTime: r.start_time,
  endTime: r.end_time,
  studentId: r.student_id,
  studentName: r.student_name,
  removedTherapistId: r.removed_therapist_id,
  removedTherapistName: r.removed_therapist_name,
  newTherapistName: r.new_therapist_name,
  action: r.action,
  reasonCode: r.reason_code,
  reasonNote: r.reason_note,
  actor: r.actor,
  createdAt: r.created_at,
});

export function insertChangeEvent(input: {
  planId: number;
  planAssignmentId: number;
  sessionId: number;
  date: string;
  slot: Slot;
  startTime: string;
  endTime: string;
  studentId: number;
  removedTherapistId: number;
  newTherapistId: number | null;
  action: PreferenceEvidence["action"];
  reasonCode: ChangeReasonCode | null;
  reasonNote: string | null;
  actor: string;
}): number {
  const r = getDb()
    .prepare(
      `INSERT INTO assignment_change_events
       (plan_id, plan_assignment_id, session_id, date, slot, start_time, end_time, student_id, removed_therapist_id,
        new_therapist_id, action, reason_code, reason_note, actor)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      input.planId,
      input.planAssignmentId,
      input.sessionId,
      input.date,
      input.slot,
      input.startTime,
      input.endTime,
      input.studentId,
      input.removedTherapistId,
      input.newTherapistId,
      input.action,
      input.reasonCode,
      input.reasonNote,
      input.actor,
    );
  return Number(r.lastInsertRowid);
}

/** Events with one of the given reason codes (oldest first). Reason-less edits are never returned. */
export function listChangeEventsByReason(codes: ChangeReasonCode[]): PreferenceEvidence[] {
  if (codes.length === 0) return [];
  const rows = getDb()
    .prepare(`${SELECT} WHERE e.reason_code IN (${codes.map(() => "?").join(", ")}) ORDER BY e.id`)
    .all(...codes) as ChangeEventRow[];
  return rows.map(toEvidence);
}

export function listChangeEventsByIds(ids: number[]): PreferenceEvidence[] {
  if (ids.length === 0) return [];
  const rows = getDb()
    .prepare(`${SELECT} WHERE e.id IN (${ids.map(() => "?").join(", ")}) ORDER BY e.date, e.start_time`)
    .all(...ids) as ChangeEventRow[];
  return rows.map(toEvidence);
}
