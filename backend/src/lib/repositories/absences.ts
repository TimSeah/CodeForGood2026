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
  bot_report_id: number | null;
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
  botReportId: r.bot_report_id,
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

/** True if the therapist is already marked away for that date and slot (a whole-day absence covers both). */
export function hasAbsence(therapistId: number, date: string, slot: Absence["slot"]): boolean {
  return !!getDb()
    .prepare(
      // A whole-day request (slot NULL) is only covered by an existing whole-day absence.
      `SELECT 1 FROM absences WHERE therapist_id = ? AND date = ? AND type != 'off' AND (slot IS NULL OR slot = ?)`,
    )
    .get(therapistId, date, slot);
}

export function createAbsence(input: Omit<Absence, "id" | "therapistName" | "reportedAt">): number {
  const r = getDb()
    .prepare("INSERT INTO absences (therapist_id, date, slot, type, note, bot_report_id) VALUES (?, ?, ?, ?, ?, ?)")
    .run(input.therapistId, input.date, input.slot, input.type, input.note, input.botReportId);
  return Number(r.lastInsertRowid);
}
