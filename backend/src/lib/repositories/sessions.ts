import { getDb } from "@/lib/db/client";
import type { ParentStatus, Session } from "@/lib/types";

interface SessionRow {
  id: number;
  date: string;
  slot: Session["slot"];
  start_time: string;
  end_time: string;
  location: Session["location"];
  status: Session["status"];
  student_id: number;
  student_name: string;
  therapist_id: number | null;
  therapist_name: string | null;
  original_therapist_id: number | null;
  cancel_reason: string | null;
  parent_status: ParentStatus | null;
}

// parent_status = acceptance state of the latest APPROVED change to this session, if any.
const SELECT = `
  SELECT se.*, st.name AS student_name, th.name AS therapist_name,
    (SELECT pa.parent_status FROM plan_assignments pa JOIN plans p ON p.id = pa.plan_id
     WHERE pa.session_id = se.id AND p.status = 'approved' ORDER BY pa.id DESC LIMIT 1) AS parent_status
  FROM sessions se
  JOIN students st ON st.id = se.student_id
  LEFT JOIN therapists th ON th.id = se.therapist_id`;

const toSession = (r: SessionRow): Session => ({
  id: r.id,
  date: r.date,
  slot: r.slot,
  startTime: r.start_time,
  endTime: r.end_time,
  location: r.location,
  status: r.status,
  studentId: r.student_id,
  studentName: r.student_name,
  therapistId: r.therapist_id,
  therapistName: r.therapist_name,
  originalTherapistId: r.original_therapist_id,
  cancelReason: r.cancel_reason,
  parentStatus: r.parent_status,
});

export function listSessionsByDate(date: string) {
  const rows = getDb()
    .prepare(`${SELECT} WHERE se.date = ? ORDER BY se.slot, st.name`)
    .all(date) as SessionRow[];
  return rows.map(toSession);
}

/** A month of sessions for one therapist (sessions they run OR originally owned) or one child. */
export function listSessionsForMonth(month: string, filter: { therapistId?: number; studentId?: number; confirmed?: true }) {
  const where = ["se.date LIKE ?"];
  const params: (string | number)[] = [`${month}-%`];
  if (filter.therapistId !== undefined) {
    where.push("(se.therapist_id = ? OR se.original_therapist_id = ?)");
    params.push(filter.therapistId, filter.therapistId);
  }
  if (filter.studentId !== undefined) {
    where.push("se.student_id = ?");
    params.push(filter.studentId);
  }
  if (filter.confirmed) {
    // Standing appointments are confirmed unless the therapist is away. A changed appointment
    // becomes confirmed only after its latest approved assignment is accepted by the parent.
    where.push("se.status = 'scheduled'", "se.therapist_id IS NOT NULL");
    where.push(`(
      (SELECT pa.parent_status FROM plan_assignments pa JOIN plans p ON p.id = pa.plan_id
       WHERE pa.session_id = se.id AND p.status = 'approved' ORDER BY pa.id DESC LIMIT 1) = 'accepted'
      OR (
        NOT EXISTS (
          SELECT 1 FROM plan_assignments pa JOIN plans p ON p.id = pa.plan_id
          WHERE pa.session_id = se.id AND p.status = 'approved'
        )
        AND NOT EXISTS (
          SELECT 1 FROM absences a
          WHERE a.therapist_id = se.therapist_id AND a.date = se.date
            AND (a.slot IS NULL OR a.slot = se.slot)
        )
      )
    )`);
  }
  const rows = getDb()
    .prepare(`${SELECT} WHERE ${where.join(" AND ")} ORDER BY se.date, se.slot`)
    .all(...params) as SessionRow[];
  return rows.map(toSession);
}

export function getSession(id: number) {
  const row = getDb().prepare(`${SELECT} WHERE se.id = ?`).get(id) as SessionRow | undefined;
  return row ? toSession(row) : null;
}

/** Moves a session to another therapist, remembering who it originally belonged to. */
export function reassignSession(id: number, therapistId: number) {
  getDb()
    .prepare(
      `UPDATE sessions
       SET original_therapist_id = COALESCE(original_therapist_id, therapist_id), therapist_id = ?,
           status = 'scheduled', cancel_reason = NULL
       WHERE id = ?`,
    )
    .run(therapistId, id);
}

/** Puts a session back on a therapist without touching original_therapist_id (used when a change is undone). */
export function setSessionTherapist(id: number, therapistId: number | null) {
  getDb().prepare("UPDATE sessions SET therapist_id = ? WHERE id = ?").run(therapistId, id);
}

export function cancelSession(id: number, reason: string) {
  getDb().prepare("UPDATE sessions SET status = 'cancelled', cancel_reason = ? WHERE id = ?").run(reason, id);
}

/** Cancels a child's sessions on a date (optionally one slot). Returns how many changed. */
export function cancelStudentSessions(studentId: number, date: string, slot: "AM" | "PM" | null, reason: string): number {
  return getDb()
    .prepare(
      `UPDATE sessions SET status = 'cancelled', cancel_reason = ?
       WHERE student_id = ? AND date = ? AND status = 'scheduled' AND (? IS NULL OR slot = ?)`,
    )
    .run(reason, studentId, date, slot, slot).changes;
}
