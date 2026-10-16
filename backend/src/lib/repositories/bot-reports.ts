import { getDb } from "@/lib/db/client";
import type { BotDayPart, BotReport, BotReportStatus, BotRole } from "@/lib/types";

interface BotReportRow {
  id: number;
  role: BotRole;
  name: string;
  phone: string | null;
  start_date: string;
  end_date: string;
  day_part: BotDayPart;
  mc_attached: number;
  reported_at: string;
  status: BotReportStatus;
  matched_therapist_id: number | null;
  matched_student_id: number | null;
  matched_name: string | null;
  affected: number;
}

// affected = therapist: sessions they owned in range (by slot); patient: their sessions in range (by slot).
const SELECT = `
  SELECT br.*, COALESCE(t.name, s.name) AS matched_name,
    (SELECT COUNT(*) FROM sessions se
     WHERE se.date BETWEEN br.start_date AND br.end_date
       AND (br.day_part = 'whole day' OR se.slot = CASE br.day_part WHEN 'morning' THEN 'AM' ELSE 'PM' END)
       AND ((br.matched_therapist_id IS NOT NULL AND COALESCE(se.original_therapist_id, se.therapist_id) = br.matched_therapist_id)
         OR (br.matched_student_id IS NOT NULL AND se.student_id = br.matched_student_id))) AS affected
  FROM bot_reports br
  LEFT JOIN therapists t ON t.id = br.matched_therapist_id
  LEFT JOIN students s ON s.id = br.matched_student_id`;

const toReport = (r: BotReportRow): BotReport => ({
  id: r.id,
  role: r.role,
  name: r.name,
  phone: r.phone,
  startDate: r.start_date,
  endDate: r.end_date,
  dayPart: r.day_part,
  mcAttached: r.mc_attached === 1,
  reportedAt: r.reported_at,
  status: r.status,
  matchedTherapistId: r.matched_therapist_id,
  matchedStudentId: r.matched_student_id,
  matchedName: r.matched_name,
  affectedSessions: r.affected,
});

/** Reports whose date range covers `date`, plus all unmatched ones (they need attention whatever the date). */
export function listBotReports(date: string): BotReport[] {
  const rows = getDb()
    .prepare(
      `${SELECT} WHERE (? BETWEEN br.start_date AND br.end_date OR br.status = 'unmatched') ORDER BY br.reported_at DESC, br.id DESC`,
    )
    .all(date) as BotReportRow[];
  return rows.map(toReport);
}

export function getBotReport(id: number): BotReport | null {
  const row = getDb().prepare(`${SELECT} WHERE br.id = ?`).get(id) as BotReportRow | undefined;
  return row ? toReport(row) : null;
}

/** Inserts a report; returns its id, or null if `sourceId` was already imported. */
export function insertBotReport(input: {
  sourceId: string | null;
  role: BotRole;
  name: string;
  phone: string | null;
  startDate: string;
  endDate: string;
  dayPart: BotDayPart;
  mcAttached: boolean;
  reportedAt: string;
}): number | null {
  const r = getDb()
    .prepare(
      `INSERT OR IGNORE INTO bot_reports (source_id, role, name, phone, start_date, end_date, day_part, mc_attached, reported_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      input.sourceId,
      input.role,
      input.name,
      input.phone,
      input.startDate,
      input.endDate,
      input.dayPart,
      input.mcAttached ? 1 : 0,
      input.reportedAt,
    );
  return r.changes ? Number(r.lastInsertRowid) : null;
}

export function setBotReportMatch(
  id: number,
  match: { status: BotReportStatus; therapistId?: number | null; studentId?: number | null },
) {
  getDb()
    .prepare(
      `UPDATE bot_reports SET status = ?, matched_therapist_id = ?, matched_student_id = ?,
       ingested_at = CASE WHEN ? = 'ingested' THEN datetime('now') ELSE ingested_at END WHERE id = ?`,
    )
    .run(match.status, match.therapistId ?? null, match.studentId ?? null, match.status, id);
}
