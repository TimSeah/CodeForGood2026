import type Database from "better-sqlite3";
import type { CasePlan, Rank } from "@/lib/types";
import { SEED_OFF_SLOTS, SEED_STUDENTS, SEED_THERAPISTS, SEED_WEEKLY_PATTERN } from "./seed-data";
import { MOCK_BLACKLIST, MOCK_PAST_COVERS, mockLogContent, mockStudentProfile } from "./seed-mock";

// The case study uses a FICTIONAL calendar: in its sheets, 3 July 2031 is a Monday and 11 July 2031 a
// Tuesday (the real 11 July 2031 is a Friday). We keep the case's dates and weekdays so the data matches
// the documents. Never derive the weekday of seeded data with Date#getDay().
const CASE_FIRST_MONDAY = 3; // day-of-month of the first Monday in July 2031 per the case sheets
const PUBLIC_HOLIDAYS = new Set(["2031-07-10"]);
export const SEED_MONTH = "2031-07";
/** Session logs are mocked for every session before this date. */
const LOGS_UNTIL = "2031-07-08";

const WEEKDAY_GROUP: ("MWF" | "TT" | undefined)[] = ["MWF", "TT", "MWF", "TT", "MWF", undefined, undefined]; // Mon..Sun

function workingDays(): { date: string; group: "MWF" | "TT" }[] {
  const out: { date: string; group: "MWF" | "TT" }[] = [];
  for (let d = 1; d <= 31; d++) {
    const date = `${SEED_MONTH}-${String(d).padStart(2, "0")}`;
    const group = WEEKDAY_GROUP[(((d - CASE_FIRST_MONDAY) % 7) + 7) % 7];
    if (group && !PUBLIC_HOLIDAYS.has(date)) out.push({ date, group });
  }
  return out;
}

/** Mock tier from the team's seniority: all seniors → Specialised, all juniors → Core, mixed → Advanced. */
function derivePlan(ranks: Rank[]): CasePlan {
  const seniors = ranks.filter((r) => r === "SBT" || r === "LBT").length;
  if (seniors === ranks.length) return "Specialised";
  if (seniors === 0) return "Core";
  return "Advanced";
}

const TABLES = [
  "notifications", "assignment_exclusions", "plan_assignments", "plans", "session_logs", "absences", "bot_reports",
  "weekly_patterns", "student_blacklist", "sessions", "team_members", "students", "therapists", "audit_log",
];

/** Wipes all data tables and inserts therapists, students, teams, patterns, a month of sessions and past logs. */
export function seedBaseData(db: Database.Database) {
  db.transaction(() => {
    for (const t of TABLES) db.exec(`DELETE FROM ${t}`);
    db.exec("DELETE FROM sqlite_sequence");

    const insertTherapist = db.prepare("INSERT INTO therapists (name, rank, is_part_time, home_area) VALUES (?, ?, ?, ?)");
    const therapistIds = new Map<string, number>();
    const rankOf = new Map<string, Rank>();
    for (const t of SEED_THERAPISTS) {
      therapistIds.set(t.name, Number(insertTherapist.run(t.name, t.rank, t.isPartTime ? 1 : 0, t.homeArea).lastInsertRowid));
      rankOf.set(t.name, t.rank);
    }

    const insertStudent = db.prepare(
      "INSERT INTO students (name, plan, home_area, guardian_name, guardian_phone) VALUES (?, ?, ?, ?, ?)",
    );
    const studentIds = new Map<string, number>();
    SEED_STUDENTS.forEach((name, i) => {
      const team = [...new Set(SEED_WEEKLY_PATTERN.filter((p) => p.student === name).map((p) => p.therapist))];
      const profile = mockStudentProfile(name, i);
      const r = insertStudent.run(name, derivePlan(team.map((t) => rankOf.get(t)!)), profile.homeArea, profile.guardianName, profile.guardianPhone);
      studentIds.set(name, Number(r.lastInsertRowid));
    });

    // A child's team = every therapist who appears on their weekly pattern.
    const insertTeam = db.prepare("INSERT OR IGNORE INTO team_members (student_id, therapist_id) VALUES (?, ?)");
    for (const p of SEED_WEEKLY_PATTERN) insertTeam.run(studentIds.get(p.student), therapistIds.get(p.therapist));

    const insertBlacklist = db.prepare("INSERT INTO student_blacklist (student_id, therapist_id, reason) VALUES (?, ?, ?)");
    for (const b of MOCK_BLACKLIST) insertBlacklist.run(studentIds.get(b.student), therapistIds.get(b.therapist), b.reason);

    const insertPattern = db.prepare(
      `INSERT INTO weekly_patterns (month, therapist_id, days, slot, start_time, end_time, student_id, location, is_off)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    for (const p of SEED_WEEKLY_PATTERN) {
      insertPattern.run(SEED_MONTH, therapistIds.get(p.therapist), p.days, p.slot, p.start, p.end, studentIds.get(p.student), p.location, 0);
    }
    for (const o of SEED_OFF_SLOTS) {
      insertPattern.run(SEED_MONTH, therapistIds.get(o.therapist), o.days, o.slot, null, null, null, "clinic", 1);
    }

    const insertSession = db.prepare(
      `INSERT INTO sessions (date, slot, start_time, end_time, location, student_id, therapist_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    );
    // Part-timers' non-working slots are stored as "off" absences so the engine never picks them.
    const insertOff = db.prepare(
      "INSERT INTO absences (therapist_id, date, slot, type, note) VALUES (?, ?, ?, 'off', 'Rostered off')",
    );
    const insertLog = db.prepare(
      `INSERT INTO session_logs (session_id, date, slot, student_id, therapist_id, attendance, summary, notes, goals)
       VALUES (?, ?, ?, ?, ?, 'present', ?, ?, ?)`,
    );
    let logIndex = 0;
    for (const { date, group } of workingDays()) {
      for (const p of SEED_WEEKLY_PATTERN.filter((x) => x.days === group)) {
        const studentId = studentIds.get(p.student)!;
        const sessionId = Number(
          insertSession.run(date, p.slot, p.start, p.end, p.location, studentId, therapistIds.get(p.therapist)).lastInsertRowid,
        );
        if (date < LOGS_UNTIL) {
          const cover = MOCK_PAST_COVERS.find((c) => c.date === date && c.slot === p.slot && c.student === p.student);
          const c = mockLogContent(p.student, logIndex++);
          insertLog.run(sessionId, date, p.slot, studentId, therapistIds.get(cover?.therapist ?? p.therapist), c.summary, c.notes, c.goals);
        }
      }
      for (const o of SEED_OFF_SLOTS.filter((x) => x.days === group)) insertOff.run(therapistIds.get(o.therapist), date, o.slot);
    }
  })();
}
