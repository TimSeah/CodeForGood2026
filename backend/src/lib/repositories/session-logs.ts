import { getDb } from "@/lib/db/client";
import { getSessionLogVideo } from "@/lib/repositories/video-reviews";
import type { Attendance, SessionLog, Slot } from "@/lib/types";

interface SessionLogRow {
  id: number;
  session_id: number | null;
  date: string;
  slot: Slot;
  student_id: number;
  student_name: string;
  therapist_id: number;
  therapist_name: string;
  attendance: Attendance;
  summary: string | null;
  notes: string | null;
  goals: string | null;
  created_at: string;
  updated_at: string;
}

const SELECT = `
  SELECT l.*, s.name AS student_name, t.name AS therapist_name
  FROM session_logs l
  JOIN students s ON s.id = l.student_id
  JOIN therapists t ON t.id = l.therapist_id`;

const toLog = (r: SessionLogRow): SessionLog => ({
  id: r.id,
  sessionId: r.session_id,
  date: r.date,
  slot: r.slot,
  studentId: r.student_id,
  studentName: r.student_name,
  therapistId: r.therapist_id,
  therapistName: r.therapist_name,
  attendance: r.attendance,
  summary: r.summary,
  notes: r.notes,
  goals: r.goals,
  videoReview: getSessionLogVideo(r.id),
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

export interface SessionLogFilter {
  date?: string;
  from?: string;
  to?: string;
  studentId?: number;
  therapistId?: number;
}

export function listSessionLogs(f: SessionLogFilter, limit = 200): SessionLog[] {
  const where: string[] = [];
  const params: (string | number)[] = [];
  if (f.date) where.push("l.date = ?"), params.push(f.date);
  if (f.from) where.push("l.date >= ?"), params.push(f.from);
  if (f.to) where.push("l.date <= ?"), params.push(f.to);
  if (f.studentId !== undefined) where.push("l.student_id = ?"), params.push(f.studentId);
  if (f.therapistId !== undefined) where.push("l.therapist_id = ?"), params.push(f.therapistId);
  const sql = `${SELECT} ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY l.date DESC, l.slot DESC LIMIT ?`;
  return (getDb().prepare(sql).all(...params, limit) as SessionLogRow[]).map(toLog);
}

export function getSessionLog(id: number): SessionLog | null {
  const row = getDb().prepare(`${SELECT} WHERE l.id = ?`).get(id) as SessionLogRow | undefined;
  return row ? toLog(row) : null;
}

/** The child's most recent logged session strictly before (date, slot). */
export function getPreviousSessionLog(studentId: number, date: string, slot: Slot): SessionLog | null {
  const row = getDb()
    .prepare(
      `${SELECT} WHERE l.student_id = ? AND (l.date < ? OR (l.date = ? AND l.slot < ?))
       ORDER BY l.date DESC, l.slot DESC LIMIT 1`,
    )
    .get(studentId, date, date, slot) as SessionLogRow | undefined;
  return row ? toLog(row) : null;
}

export type SessionLogInput = Pick<
  SessionLog,
  "sessionId" | "date" | "slot" | "studentId" | "therapistId" | "attendance" | "summary" | "notes" | "goals"
>;

export function createSessionLog(input: SessionLogInput): number {
  const r = getDb()
    .prepare(
      `INSERT INTO session_logs (session_id, date, slot, student_id, therapist_id, attendance, summary, notes, goals)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(input.sessionId, input.date, input.slot, input.studentId, input.therapistId, input.attendance, input.summary, input.notes, input.goals);
  return Number(r.lastInsertRowid);
}

export function updateSessionLog(id: number, input: Partial<SessionLogInput>) {
  const cols: Record<keyof SessionLogInput, string> = {
    sessionId: "session_id",
    date: "date",
    slot: "slot",
    studentId: "student_id",
    therapistId: "therapist_id",
    attendance: "attendance",
    summary: "summary",
    notes: "notes",
    goals: "goals",
  };
  const entries = (Object.keys(cols) as (keyof SessionLogInput)[]).filter((k) => input[k] !== undefined);
  if (!entries.length) return;
  getDb()
    .prepare(`UPDATE session_logs SET ${entries.map((k) => `${cols[k]} = ?`).join(", ")}, updated_at = datetime('now') WHERE id = ?`)
    .run(...entries.map((k) => input[k] as string | number | null), id);
}

export function deleteSessionLog(id: number) {
  getDb().prepare("DELETE FROM session_logs WHERE id = ?").run(id);
}
