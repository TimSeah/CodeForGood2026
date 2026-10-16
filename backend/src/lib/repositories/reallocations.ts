import { getDb } from "@/lib/db/client";
import type { Reallocation } from "@/lib/types";

interface ReallocationRow {
  id: number;
  session_id: number;
  date: string;
  slot: Reallocation["slot"];
  student_name: string;
  from_therapist_id: number | null;
  from_therapist_name: string | null;
  to_therapist_id: number | null;
  to_therapist_name: string | null;
  score: number | null;
  rationale: string;
  status: Reallocation["status"];
  proposed_by: string;
  decided_by: string | null;
  created_at: string;
  decided_at: string | null;
}

const SELECT = `
  SELECT r.*, se.date, se.slot, st.name AS student_name,
         ft.name AS from_therapist_name, tt.name AS to_therapist_name
  FROM reallocations r
  JOIN sessions se ON se.id = r.session_id
  JOIN students st ON st.id = se.student_id
  LEFT JOIN therapists ft ON ft.id = r.from_therapist_id
  LEFT JOIN therapists tt ON tt.id = r.to_therapist_id`;

const toReallocation = (r: ReallocationRow): Reallocation => ({
  id: r.id,
  sessionId: r.session_id,
  date: r.date,
  slot: r.slot,
  studentName: r.student_name,
  fromTherapistId: r.from_therapist_id,
  fromTherapistName: r.from_therapist_name,
  toTherapistId: r.to_therapist_id,
  toTherapistName: r.to_therapist_name,
  score: r.score,
  rationale: JSON.parse(r.rationale) as string[],
  status: r.status,
  proposedBy: r.proposed_by,
  decidedBy: r.decided_by,
  createdAt: r.created_at,
  decidedAt: r.decided_at,
});

export function listReallocationsByDate(date: string): Reallocation[] {
  const rows = getDb()
    .prepare(`${SELECT} WHERE se.date = ? ORDER BY se.slot, st.name`)
    .all(date) as ReallocationRow[];
  return rows.map(toReallocation);
}

export function getReallocation(id: number): Reallocation | null {
  const row = getDb().prepare(`${SELECT} WHERE r.id = ?`).get(id) as ReallocationRow | undefined;
  return row ? toReallocation(row) : null;
}

export function createReallocation(input: {
  sessionId: number;
  fromTherapistId: number | null;
  toTherapistId: number | null;
  score: number | null;
  rationale: string[];
  proposedBy: string;
}): number {
  const r = getDb()
    .prepare(
      `INSERT INTO reallocations (session_id, from_therapist_id, to_therapist_id, score, rationale, proposed_by)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(
      input.sessionId,
      input.fromTherapistId,
      input.toTherapistId,
      input.score,
      JSON.stringify(input.rationale),
      input.proposedBy,
    );
  return Number(r.lastInsertRowid);
}

/** Drops still-pending proposals for a date so the engine can re-run cleanly. */
export function deletePendingProposalsForDate(date: string) {
  getDb()
    .prepare(
      `DELETE FROM reallocations WHERE status = 'proposed'
       AND session_id IN (SELECT id FROM sessions WHERE date = ?)`,
    )
    .run(date);
}

export function setReallocationStatus(id: number, status: "approved" | "rejected", decidedBy: string) {
  getDb()
    .prepare("UPDATE reallocations SET status = ?, decided_by = ?, decided_at = datetime('now') WHERE id = ?")
    .run(status, decidedBy, id);
}
