import { getDb } from "@/lib/db/client";
import type { Student } from "@/lib/types";

interface StudentRow {
  id: number;
  name: string;
  plan: Student["plan"];
  team: string | null; // comma-separated therapist ids from GROUP_CONCAT
}

export function listStudents(): Student[] {
  const rows = getDb()
    .prepare(
      `SELECT s.id, s.name, s.plan, GROUP_CONCAT(tm.therapist_id) AS team
       FROM students s LEFT JOIN team_members tm ON tm.student_id = s.id
       GROUP BY s.id ORDER BY s.name`,
    )
    .all() as StudentRow[];
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    plan: r.plan,
    teamTherapistIds: r.team ? r.team.split(",").map(Number) : [],
  }));
}
