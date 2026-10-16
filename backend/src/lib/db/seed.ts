import type Database from "better-sqlite3";
import { SEED_OFF_SLOTS, SEED_STUDENTS, SEED_THERAPISTS, SEED_WEEKLY_PATTERN } from "./seed-data";

// The case study uses a FICTIONAL calendar: in its sheets, 3 July 2031 is a Monday and 11 July 2031 a
// Tuesday (the real 11 July 2031 is a Friday). We keep the case's dates and weekdays so the data matches
// the documents. Never derive the weekday of seeded data with Date#getDay().
const CASE_FIRST_MONDAY = 3; // day-of-month of the first Monday in July 2031 per the case sheets
const PUBLIC_HOLIDAYS = new Set(["2031-07-10"]);

const WEEKDAY_GROUP: ("MWF" | "TT" | undefined)[] = ["MWF", "TT", "MWF", "TT", "MWF", undefined, undefined]; // Mon..Sun

function workingDays(): { date: string; group: "MWF" | "TT" }[] {
  const out: { date: string; group: "MWF" | "TT" }[] = [];
  for (let d = 1; d <= 31; d++) {
    const date = `2031-07-${String(d).padStart(2, "0")}`;
    const group = WEEKDAY_GROUP[(((d - CASE_FIRST_MONDAY) % 7) + 7) % 7];
    if (group && !PUBLIC_HOLIDAYS.has(date)) out.push({ date, group });
  }
  return out;
}

/** Wipes all data tables and inserts therapists, students, teams and a month of sessions. */
export function seedBaseData(db: Database.Database) {
  db.transaction(() => {
    for (const t of ["notifications", "reallocations", "audit_log", "absences", "sessions", "team_members", "students", "therapists"]) {
      db.exec(`DELETE FROM ${t}`);
    }
    db.exec("DELETE FROM sqlite_sequence");

    const insertTherapist = db.prepare(
      "INSERT INTO therapists (name, rank, is_part_time, home_area) VALUES (?, ?, ?, ?)",
    );
    const therapistIds = new Map<string, number>();
    for (const t of SEED_THERAPISTS) {
      const r = insertTherapist.run(t.name, t.rank, t.isPartTime ? 1 : 0, t.homeArea);
      therapistIds.set(t.name, Number(r.lastInsertRowid));
    }

    const insertStudent = db.prepare("INSERT INTO students (name) VALUES (?)");
    const studentIds = new Map<string, number>();
    for (const name of SEED_STUDENTS) {
      studentIds.set(name, Number(insertStudent.run(name).lastInsertRowid));
    }

    // A child's team = every therapist who appears on their weekly pattern.
    const insertTeam = db.prepare("INSERT OR IGNORE INTO team_members (student_id, therapist_id) VALUES (?, ?)");
    for (const p of SEED_WEEKLY_PATTERN) {
      insertTeam.run(studentIds.get(p.student), therapistIds.get(p.therapist));
    }

    const insertSession = db.prepare(
      `INSERT INTO sessions (date, slot, start_time, end_time, location, student_id, therapist_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    );
    // Part-timers' non-working slots are stored as "off" absences so the engine never picks them.
    const insertOff = db.prepare(
      "INSERT INTO absences (therapist_id, date, slot, type, note) VALUES (?, ?, ?, 'off', 'Rostered off')",
    );
    for (const { date, group } of workingDays()) {
      for (const p of SEED_WEEKLY_PATTERN.filter((x) => x.days === group)) {
        insertSession.run(date, p.slot, p.start, p.end, p.location, studentIds.get(p.student), therapistIds.get(p.therapist));
      }
      for (const o of SEED_OFF_SLOTS.filter((x) => x.days === group)) {
        insertOff.run(therapistIds.get(o.therapist), date, o.slot);
      }
    }
  })();
}

/** The disruption described in docs/data/Case-Scenario.docx (Tuesday 11 July 2031). */
export const SCENARIO_DATE = "2031-07-11";
const SCENARIO_ABSENCES: { therapist: string; type: "annual" | "medical" | "urgent"; slot: "AM" | "PM" | null }[] = [
  ...["Jennifer", "Jia Yi", "Jasmine", "Lilian"].map((therapist) => ({ therapist, type: "annual" as const, slot: null })),
  ...["Tara", "Li Ting", "Mark", "Jacqueline", "Dahlia", "Juliana", "Camila"].map((therapist) => ({
    therapist,
    type: "medical" as const,
    slot: null,
  })),
  { therapist: "Anika", type: "urgent", slot: null },
  { therapist: "Eileen", type: "medical", slot: "PM" },
];
const SCENARIO_STUDENT_CANCELLATIONS = ["Brock", "Richard"]; // PM, fever

export function seedScenario(db: Database.Database) {
  db.transaction(() => {
    const insertAbsence = db.prepare(
      "INSERT INTO absences (therapist_id, date, slot, type) SELECT id, ?, ?, ? FROM therapists WHERE name = ?",
    );
    for (const a of SCENARIO_ABSENCES) insertAbsence.run(SCENARIO_DATE, a.slot, a.type, a.therapist);

    const cancel = db.prepare(
      `UPDATE sessions SET status = 'cancelled', cancel_reason = 'Child unwell (fever)'
       WHERE date = ? AND slot = 'PM' AND student_id = (SELECT id FROM students WHERE name = ?)`,
    );
    for (const s of SCENARIO_STUDENT_CANCELLATIONS) cancel.run(SCENARIO_DATE, s);
  })();
}
