import { getDb } from "@/lib/db/client";
import type { Absence } from "@/lib/types";

interface AbsenceRow {
  id: number;
  therapist_id: number;
  therapist_name: string;
  date: string;
  slot: Absence["slot"];
  type: Absence["type"];
  note: string | null;
  reported_at: string;
}

const toAbsence = (r: AbsenceRow): Absence => ({
  id: r.id,
  therapistId: r.therapist_id,
  therapistName: r.therapist_name,
  date: r.date,
  slot: r.slot,
  type: r.type,
  note: r.note,
  reportedAt: r.reported_at,
});

export function listAbsencesByDate(date: string): Absence[] {
  const rows = getDb()
    .prepare(
      `SELECT a.*, t.name AS therapist_name FROM absences a
       JOIN therapists t ON t.id = a.therapist_id
       WHERE a.date = ? ORDER BY t.name`,
    )
    .all(date) as AbsenceRow[];
  return rows.map(toAbsence);
}

export function createAbsence(input: Omit<Absence, "id" | "therapistName" | "reportedAt">): number {
  const r = getDb()
    .prepare("INSERT INTO absences (therapist_id, date, slot, type, note) VALUES (?, ?, ?, ?, ?)")
    .run(input.therapistId, input.date, input.slot, input.type, input.note);
  return Number(r.lastInsertRowid);
}
