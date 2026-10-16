import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { eachDate } from "@/lib/dates";
import { getDb } from "@/lib/db/client";
import { HttpError } from "@/lib/http";
import { createAbsence, hasAbsence } from "@/lib/repositories/absences";
import { logAudit } from "@/lib/repositories/audit";
import { getBotReport, insertBotReport, setBotReportMatch } from "@/lib/repositories/bot-reports";
import { cancelStudentSessions } from "@/lib/repositories/sessions";
import { listStudents } from "@/lib/repositories/students";
import { listTherapists } from "@/lib/repositories/therapists";
import type { BotDayPart, BotReport, BotRole, Slot } from "@/lib/types";
import { generatePlanForDate } from "./plans";

// WhatsApp intake. Agreed rule: reports are ingested AUTOMATICALLY when the name matches the roster, and the
// engine re-plans straight away; the admin still approves every plan. Unmatched names wait for the admin.
// Note: the bot's README warns reports are unverified (free-text names, MC not checked) — the Disruptions page
// shows the MC flag and the raw name so the admin can spot problems before approving.

export const BOT_DB_PATH = path.resolve(/*turbopackIgnore: true*/ process.cwd(), process.env.BOT_DB_PATH ?? "../bot/absences.sqlite");

const SLOT_OF: Record<BotDayPart, Slot | null> = { "whole day": null, morning: "AM", afternoon: "PM" };
const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

interface BotAbsenceRow {
  id: number;
  role: string;
  name: string;
  phone: string;
  start_date: string;
  end_date: string;
  day_part: string;
  mc_attached: number;
  created_at: string;
}

/** Copies new rows from the bot's SQLite DB (read-only) and ingests them. */
export function syncFromBot(actor: string) {
  if (!fs.existsSync(BOT_DB_PATH)) return { available: false, path: BOT_DB_PATH, imported: 0 };
  const botDb = new Database(BOT_DB_PATH, { readonly: true, fileMustExist: true });
  let rows: BotAbsenceRow[];
  try {
    rows = botDb
      .prepare(
        `SELECT id, role, name, phone, start_date, end_date, day_part, mc_media_id IS NOT NULL AS mc_attached, created_at
         FROM absences ORDER BY id`,
      )
      .all() as BotAbsenceRow[];
  } finally {
    botDb.close();
  }

  let imported = 0;
  for (const r of rows) {
    if (!["therapist", "patient"].includes(r.role) || !(r.day_part in SLOT_OF)) continue;
    const id = insertBotReport({
      sourceId: `bot:${r.id}`,
      role: r.role as BotRole,
      name: r.name,
      phone: r.phone,
      startDate: r.start_date,
      endDate: r.end_date,
      dayPart: r.day_part as BotDayPart,
      mcAttached: r.mc_attached === 1,
      reportedAt: r.created_at,
    });
    if (id === null) continue; // already imported
    imported++;
    ingestReport(id, actor);
  }
  return { available: true, path: BOT_DB_PATH, imported };
}

/** Adds a report without the bot (demo / phone calls taken by the admin), then ingests it. */
export function simulateReport(
  input: { role: BotRole; name: string; phone?: string | null; startDate: string; endDate: string; dayPart: BotDayPart; mcAttached: boolean },
  actor: string,
): BotReport {
  const id = insertBotReport({ ...input, sourceId: null, phone: input.phone ?? null, reportedAt: new Date().toISOString().replace("T", " ").slice(0, 19) });
  return ingestReport(id!, actor);
}

/**
 * Matches a report to the roster (or uses the admin's explicit match), records its effect, and re-plans
 * every affected date.
 */
export function ingestReport(
  id: number,
  actor: string,
  match?: { therapistId?: number; studentId?: number },
  opts: { replan?: boolean } = {},
): BotReport {
  const report = getBotReport(id);
  if (!report) throw new HttpError(404, `Report ${id} not found`);
  if (report.status === "ingested") throw new HttpError(409, "Report already ingested");

  let therapistId = match?.therapistId;
  let studentId = match?.studentId;
  if (therapistId === undefined && studentId === undefined) {
    if (report.role === "therapist") therapistId = listTherapists().find((t) => norm(t.name) === norm(report.name))?.id;
    else studentId = listStudents().find((s) => norm(s.name) === norm(report.name))?.id;
  }
  if (therapistId === undefined && studentId === undefined) {
    setBotReportMatch(id, { status: "unmatched" });
    logAudit({ actor, action: "bot_report.unmatched", entityType: "bot_report", entityId: id, details: { name: report.name } });
    return getBotReport(id)!;
  }

  const slot = SLOT_OF[report.dayPart];
  const dates = eachDate(report.startDate, report.endDate);
  getDb().transaction(() => {
    for (const date of dates) {
      if (therapistId !== undefined) {
        if (!hasAbsence(therapistId, date, slot)) {
          createAbsence({
            therapistId,
            date,
            slot,
            type: report.mcAttached ? "medical" : "other",
            note: `WhatsApp report #${id}${report.mcAttached ? " (MC attached — verify)" : ""}`,
            botReportId: id,
          });
        }
      } else {
        cancelStudentSessions(studentId!, date, slot, "Child absent (reported via WhatsApp)");
      }
    }
    setBotReportMatch(id, { status: "ingested", therapistId: therapistId ?? null, studentId: studentId ?? null });
    logAudit({ actor, action: "bot_report.ingested", entityType: "bot_report", entityId: id, details: { therapistId, studentId, dates } });
  })();

  // Auto-run the engine for each affected date with sessions (a child absence can free a therapist up).
  if (opts.replan !== false) for (const date of dates) generatePlanForDate(date, "engine");
  return getBotReport(id)!;
}

export function ignoreReport(id: number, actor: string): BotReport {
  const report = getBotReport(id);
  if (!report) throw new HttpError(404, `Report ${id} not found`);
  if (report.status === "ingested") throw new HttpError(409, "Report already ingested");
  setBotReportMatch(id, { status: "ignored" });
  logAudit({ actor, action: "bot_report.ignored", entityType: "bot_report", entityId: id });
  return getBotReport(id)!;
}
