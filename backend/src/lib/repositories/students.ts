import { getDb } from "@/lib/db/client";
import type { Student } from "@/lib/types";

interface StudentRow {
  id: number;
  name: string;
  plan: Student["plan"];
  home_area: string | null;
  guardian_name: string | null;
  guardian_phone: string | null;
  team: string | null; // comma-separated therapist ids from GROUP_CONCAT
  blacklist: string | null;
}

const ids = (csv: string | null) => (csv ? csv.split(",").map(Number) : []);

const SELECT = `
  SELECT s.*,
    (SELECT GROUP_CONCAT(therapist_id) FROM team_members WHERE student_id = s.id) AS team,
    (SELECT GROUP_CONCAT(therapist_id) FROM student_blacklist WHERE student_id = s.id) AS blacklist
  FROM students s`;

const toStudent = (r: StudentRow): Student => ({
  id: r.id,
  name: r.name,
  plan: r.plan,
  homeArea: r.home_area,
  guardianName: r.guardian_name,
  guardianPhone: r.guardian_phone,
  teamTherapistIds: ids(r.team),
  blacklistTherapistIds: ids(r.blacklist),
});

export function listStudents(): Student[] {
  return (getDb().prepare(`${SELECT} ORDER BY s.name`).all() as StudentRow[]).map(toStudent);
}

export function getStudent(id: number): Student | null {
  const row = getDb().prepare(`${SELECT} WHERE s.id = ?`).get(id) as StudentRow | undefined;
  return row ? toStudent(row) : null;
}

export function setGuardianPhone(id: number, phone: string | null): boolean {
  return getDb().prepare("UPDATE students SET guardian_phone = ? WHERE id = ?").run(phone, id).changes === 1;
}

/**
 * studentId → therapists who worked with the child before `beforeDate` without being the regular therapist:
 * anyone who logged a session with them, plus anyone a past session was reassigned to.
 */
export function listCoverHistory(beforeDate: string): Map<number, Set<number>> {
  const rows = getDb()
    .prepare(
      `SELECT student_id, therapist_id FROM session_logs WHERE date < ?
       UNION
       SELECT student_id, therapist_id FROM sessions
       WHERE date < ? AND original_therapist_id IS NOT NULL AND therapist_id IS NOT NULL AND status = 'scheduled'`,
    )
    .all(beforeDate, beforeDate) as { student_id: number; therapist_id: number }[];
  const out = new Map<number, Set<number>>();
  for (const r of rows) {
    if (!out.has(r.student_id)) out.set(r.student_id, new Set());
    out.get(r.student_id)!.add(r.therapist_id);
  }
  return out;
}
