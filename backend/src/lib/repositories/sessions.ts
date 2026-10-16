import { getDb } from "@/lib/db/client";
import type { Session } from "@/lib/types";

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
}

const SELECT = `
  SELECT se.*, st.name AS student_name, th.name AS therapist_name
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
});

export function listSessionsByDate(date: string): Session[] {
  const rows = getDb()
    .prepare(`${SELECT} WHERE se.date = ? ORDER BY se.slot, st.name`)
    .all(date) as SessionRow[];
  return rows.map(toSession);
}

export function getSession(id: number): Session | null {
  const row = getDb().prepare(`${SELECT} WHERE se.id = ?`).get(id) as SessionRow | undefined;
  return row ? toSession(row) : null;
}

/** Moves a session to another therapist, remembering who it originally belonged to. */
export function reassignSession(id: number, therapistId: number) {
  getDb()
    .prepare(
      `UPDATE sessions
       SET original_therapist_id = COALESCE(original_therapist_id, therapist_id), therapist_id = ?
       WHERE id = ?`,
    )
    .run(therapistId, id);
}

export function cancelSession(id: number, reason: string) {
  getDb().prepare("UPDATE sessions SET status = 'cancelled', cancel_reason = ? WHERE id = ?").run(reason, id);
}
