import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { getDb } from "@/lib/db/client";
import { HttpError } from "@/lib/http";
import { logAudit } from "@/lib/repositories/audit";
import {
  createSessionLog,
  deleteSessionLog,
  getSessionLog,
  type SessionLogInput,
  updateSessionLog,
} from "@/lib/repositories/session-logs";
import { getStudent } from "@/lib/repositories/students";
import { getTherapist } from "@/lib/repositories/therapists";
import type { SessionLog } from "@/lib/types";

// Session logs (therapist portal): attendance + what happened. They feed the engine's "history" step and the
// handover sent to substitute therapists.

function checkRefs(input: Partial<SessionLogInput>) {
  if (input.studentId !== undefined && !getStudent(input.studentId)) throw new HttpError(404, `Child ${input.studentId} not found`);
  if (input.therapistId !== undefined && !getTherapist(input.therapistId)) {
    throw new HttpError(404, `Therapist ${input.therapistId} not found`);
  }
}

export function getSessionLogOrThrow(id: number): SessionLog {
  const log = getSessionLog(id);
  if (!log) throw new HttpError(404, `Session log ${id} not found`);
  return log;
}

export function addSessionLog(input: SessionLogInput, actor: string): SessionLog {
  checkRefs(input);
  const id = getDb().transaction(() => {
    const id = createSessionLog(input);
    logAudit({ actor, action: "session_log.created", entityType: "session_log", entityId: id });
    return id;
  })();
  return getSessionLog(id)!;
}

export function editSessionLog(id: number, input: Partial<SessionLogInput>, actor: string): SessionLog {
  getSessionLogOrThrow(id);
  checkRefs(input);
  getDb().transaction(() => {
    updateSessionLog(id, input);
    logAudit({ actor, action: "session_log.updated", entityType: "session_log", entityId: id, details: Object.keys(input) });
  })();
  return getSessionLog(id)!;
}

export function removeSessionLog(id: number, actor: string) {
  getSessionLogOrThrow(id);
  getDb().transaction(() => {
    deleteSessionLog(id);
    logAudit({ actor, action: "session_log.deleted", entityType: "session_log", entityId: id });
  })();
}

/** A one-session PDF for the substitute therapist. Contains ONLY this log — no other portal data. */
export async function renderSessionLogPdf(log: SessionLog, shareableOnly = false): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Session log - ${log.studentName} - ${log.date}`);
  let page = pdf.addPage([595, 842]); // A4
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const margin = 50;
  const width = 595 - margin * 2;
  let y = 842 - margin;

  // Standard fonts only cover WinAnsi; replace anything else so the PDF never fails to render.
  const safe = (s: string) => s.replace(/[^\x20-\x7E\n]/g, "?");
  const wrap = (text: string, size: number) => {
    const lines: string[] = [];
    for (const para of safe(text).split("\n")) {
      let line = "";
      for (const word of para.split(" ")) {
        const next = line ? `${line} ${word}` : word;
        if (regular.widthOfTextAtSize(next, size) > width && line) {
          lines.push(line);
          line = word;
        } else line = next;
      }
      lines.push(line);
    }
    return lines;
  };
  const write = (text: string, opts: { size?: number; font?: typeof regular; gap?: number } = {}) => {
    const size = opts.size ?? 11;
    for (const line of wrap(text, size)) {
      if (y < margin) {
        page = pdf.addPage([595, 842]);
        y = 842 - margin;
      }
      page.drawText(line, { x: margin, y, size, font: opts.font ?? regular, color: rgb(0.1, 0.1, 0.1) });
      y -= size + 4;
    }
    y -= opts.gap ?? 6;
  };
  const section = (label: string, value: string | null) => {
    write(label, { font: bold, size: 12, gap: 0 });
    write(value?.trim() || "-", { gap: 12 });
  };

  write("Session log (confidential)", { font: bold, size: 18, gap: 4 });
  write("For the covering therapist only. Do not forward.", { size: 9, gap: 16 });
  section("Child", log.studentName);
  section("Session", `${log.date} - ${log.slot}`);
  section("Therapist", log.therapistName);
  section("Attendance", log.attendance);
  section("Summary", log.summary);
  section("Goals / programmes worked on", log.goals);
  if (!shareableOnly) section("Notes", log.notes);
  return pdf.save();
}
