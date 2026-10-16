import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Each run gets its own throwaway SQLite file. Set before the DB client module is imported.
const DB_FILE = path.join(os.tmpdir(), `prefs-test-${process.pid}-${Date.now()}.db`);
process.env.DATABASE_PATH = DB_FILE;

type Svc = typeof import("./index");
type Plans = typeof import("../plans");
let svc: Svc;
let plans: Plans;
let db: import("better-sqlite3").Database;
let audit: typeof import("@/lib/repositories/audit");
let repo: typeof import("@/lib/repositories/plans");

const JADE = 1;
const ALEXA = 2;
const CELINE = 3;
const ANTHONY = 100;
const DATES = ["2031-07-04", "2031-07-07", "2031-07-11"];

/** A draft plan for `date` where Jade (proposed) covers Anthony's PM session after Celine is away. */
function draftFor(date: string) {
  const sessionId = Number(
    db
      .prepare(
        "INSERT INTO sessions (date, slot, start_time, end_time, student_id, therapist_id) VALUES (?, 'PM', '14:00', '17:30', ?, ?)",
      )
      .run(date, ANTHONY, CELINE).lastInsertRowid,
  );
  db.prepare("INSERT INTO absences (therapist_id, date, slot, type) VALUES (?, ?, NULL, 'medical')").run(CELINE, date);
  const planId = repo.createPlan({ date, kind: "primary", parentPlanId: null, createdBy: "test" });
  repo.createAssignment({ planId, sessionId, fromTherapistId: CELINE, toTherapistId: JADE, step: "tier", distanceKm: null, rationale: ["test"], chainId: null });
  return plans.getPlanOrThrow(planId);
}

const auditActions = () => audit.listAudit(500).map((e) => e.action);

beforeAll(async () => {
  const client = await import("@/lib/db/client");
  db = client.getDb();
  db.exec(`
    INSERT INTO therapists (id, name, rank) VALUES (1, 'Jade', 'BT'), (2, 'Alexa', 'SBT'), (3, 'Celine', 'SBT');
    INSERT INTO students (id, name, plan) VALUES (100, 'Anthony', 'Core');
  `);
  svc = await import("./index");
  plans = await import("../plans");
  audit = await import("@/lib/repositories/audit");
  repo = await import("@/lib/repositories/plans");
});

afterAll(async () => {
  (await import("@/lib/db/client")).closeDb();
  for (const suffix of ["", "-wal", "-shm"]) fs.rmSync(DB_FILE + suffix, { force: true });
});

describe("preference memory (service + DB)", () => {
  it("records reason-less changes but never learns from them", () => {
    const plan = draftFor("2031-07-01");
    plans.editAssignment(plan.id, plan.assignments[0].id, ALEXA, "admin"); // no reason
    expect(svc.listPreferences()).toHaveLength(0);
    expect(auditActions()).toContain("preference_evidence.recorded");
  });

  it("suggests after 3 reasoned changes on separate dates — and the suggestion does NOT affect scheduling", () => {
    for (const date of DATES) {
      const plan = draftFor(date);
      plans.editAssignment(plan.id, plan.assignments[0].id, ALEXA, "admin", { code: "child_incompatible", note: "Anthony gets upset" });
    }
    const [s] = svc.listPreferences(["suggested"]);
    expect(s).toMatchObject({ type: "pairing", therapistId: JADE, studentId: ANTHONY, status: "suggested", source: "pattern" });
    expect(s.evidence).toHaveLength(3);
    expect(s.evidence[0].reasonNote).toBe("Anthony gets upset");
    expect(auditActions()).toContain("preference.suggested");

    // Still pending: a new draft can propose Jade for Anthony with no preference errors.
    const plan = draftFor("2031-07-14");
    expect(plan.assignments[0].toTherapistId).toBe(JADE);
    expect(plan.issues.some((i) => /Rule #/.test(i.message))).toBe(false);
  });

  it("confirming as HARD makes it a validation error; the confirmer and audit are recorded", () => {
    const [s] = svc.listPreferences(["suggested"]);
    const active = svc.confirmPreference(s.id, { strength: "hard", reason: "Parent request" }, "supervisor-mei");
    expect(active).toMatchObject({ status: "active", strength: "hard", confirmedBy: "supervisor-mei", reason: "Parent request" });
    expect(active.confirmedAt).not.toBeNull();
    expect(auditActions()).toContain("preference.confirmed");

    const plan = plans.listPlans("2031-07-14").find((p) => p.status === "draft")!;
    expect(plan.issues.some((i) => i.level === "error" && /breaks confirmed Rule/.test(i.message))).toBe(true);
    // And the engine now avoids Jade for Anthony when re-drafting (Alexa is free).
    const fresh = plans.generatePlanForDate("2031-07-14", "test")!;
    expect(fresh.assignments[0].toTherapistId).toBe(ALEXA);
    expect(fresh.assignments[0].rationale.join(" ")).toMatch(/Never assign Jade to Anthony/);
  });

  it("edit, pause, resume and remove are all audited; paused rules stop applying", () => {
    const [p] = svc.listPreferences(["active"]);
    svc.editPreference(p.id, { strength: "soft" }, "admin");
    expect(svc.getPreferenceOrThrow(p.id).strength).toBe("soft");
    svc.pausePreference(p.id, "admin");
    const plan = plans.listPlans("2031-07-14").find((x) => x.status === "draft")!;
    expect(plan.issues.some((i) => /Rule #/.test(i.message))).toBe(false);
    svc.resumePreference(p.id, "admin");
    svc.removePreference(p.id, "admin");
    expect(svc.getPreferenceOrThrow(p.id).status).toBe("removed");
    for (const action of ["preference.edited", "preference.paused", "preference.resumed", "preference.removed"]) {
      expect(auditActions()).toContain(action);
    }
  });

  it("a rejected suggestion is not suggested again, even with more evidence", () => {
    for (const date of ["2031-07-17", "2031-07-18", "2031-07-19"]) {
      const plan = draftFor(date);
      plans.rejectAssignment(plan.id, plan.assignments[0].id, "admin", { code: "child_incompatible" });
    }
    const [s] = svc.listPreferences(["suggested"]);
    expect(s).toBeDefined(); // re-suggested only because the earlier rule was REMOVED and this evidence is newer
    svc.rejectPreference(s.id, "Was a one-week issue", "admin");
    expect(auditActions()).toContain("preference.rejected");

    for (const date of ["2031-07-21", "2031-07-22", "2031-07-23"]) {
      const plan = draftFor(date);
      plans.editAssignment(plan.id, plan.assignments[0].id, ALEXA, "admin", { code: "child_incompatible" });
    }
    expect(svc.listPreferences(["suggested"])).toHaveLength(0);
  });

  it("time rules can't be confirmed without explicit days, time, start/end and ongoing", async () => {
    const created = () =>
      svc.createPreference({ type: "time_unavailable", therapistId: ALEXA, strength: "hard", days: [2], boundaryTime: "17:00" }, "admin");
    expect(created).toThrow(/explicit days, an exact time, and whether it applies/);
    const ok = svc.createPreference(
      { type: "time_unavailable", therapistId: ALEXA, strength: "hard", days: [2], boundaryTime: "17:00", appliesTo: "end", ongoing: true },
      "admin",
    );
    expect(ok).toMatchObject({ status: "active", source: "admin", confirmedBy: "admin", effectiveTo: null });
    expect(ok.summary).toBe("Alexa can't take sessions running past 5:00 pm on Tue");
    expect(auditActions()).toContain("preference.created");
  });

  it("an agent prompt that sounds lasting becomes a suggestion, not a rule", () => {
    const s = svc.suggestFromAgentPrompt("From now on avoid Celine for Anthony", "admin")!;
    expect(s).toMatchObject({ status: "suggested", source: "agent_prompt", strength: "soft", agentPrompt: "From now on avoid Celine for Anthony" });
    expect(s.question).toMatch(/applied to this draft only/);
    // Asking again doesn't create a duplicate.
    expect(svc.suggestFromAgentPrompt("From now on avoid Celine for Anthony", "admin")).toBeNull();
  });
});
