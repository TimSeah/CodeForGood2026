import { getDb } from "@/lib/db/client";
import { insertBotReport } from "@/lib/repositories/bot-reports";
import type { BotDayPart, BotRole } from "@/lib/types";
import { ingestReport } from "./intake";
import { generatePlanForDate } from "./plans";

// The disruption in docs/data/Case-Scenario.docx (Tuesday 11 July 2031), loaded the way it would arrive:
// annual leave is planned (entered directly), everything else comes in as WhatsApp reports.

export const SCENARIO_DATE = "2031-07-11";

const ANNUAL_LEAVE = ["Jennifer", "Jia Yi", "Jasmine", "Lilian"];

const REPORTS: { role: BotRole; name: string; dayPart: BotDayPart; mc: boolean; at: string }[] = [
  ...["Tara", "Li Ting", "Mark", "Dahlia", "Juliana", "Camila"].map((name, i) => ({
    role: "therapist" as const,
    name,
    dayPart: "whole day" as const,
    mc: true,
    at: `${SCENARIO_DATE} 06:${String(20 + i * 5).padStart(2, "0")}:00`,
  })),
  // Typed loosely on purpose: shows an unmatched report the admin has to map to the roster.
  { role: "therapist", name: "Jacq", dayPart: "whole day", mc: true, at: `${SCENARIO_DATE} 06:52:00` },
  { role: "therapist", name: "Anika", dayPart: "whole day", mc: false, at: `${SCENARIO_DATE} 06:58:00` },
  { role: "therapist", name: "Eileen", dayPart: "afternoon", mc: true, at: `${SCENARIO_DATE} 11:40:00` },
  { role: "patient", name: "Brock", dayPart: "afternoon", mc: false, at: `${SCENARIO_DATE} 11:15:00` },
  { role: "patient", name: "Richard", dayPart: "afternoon", mc: false, at: `${SCENARIO_DATE} 11:20:00` },
];

export function seedScenario() {
  const db = getDb();
  db.transaction(() => {
    const insertAbsence = db.prepare(
      "INSERT INTO absences (therapist_id, date, slot, type, note) SELECT id, ?, NULL, 'annual', 'Planned leave' FROM therapists WHERE name = ?",
    );
    for (const name of ANNUAL_LEAVE) insertAbsence.run(SCENARIO_DATE, name);
  })();

  REPORTS.forEach((r, i) => {
    const id = insertBotReport({
      sourceId: `demo:${i}`,
      role: r.role,
      name: r.name,
      phone: `+65 9000 ${String(2000 + i)}`,
      startDate: SCENARIO_DATE,
      endDate: SCENARIO_DATE,
      dayPart: r.dayPart,
      mcAttached: r.mc,
      reportedAt: r.at,
    });
    if (id !== null) ingestReport(id, "whatsapp", undefined, { replan: false });
  });
  generatePlanForDate(SCENARIO_DATE, "engine");
}
