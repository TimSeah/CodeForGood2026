import { describe, expect, it } from "vitest";
import type { Absence, PlanAssignment, Session, Therapist } from "@/lib/types";
import { candidatesForAssignment } from "./candidates";
import { proposeReallocations } from "./engine";
import { matchingRules, type PreferenceRule, preferenceApplies, summarizePreference } from "./preferences";
import type { EngineStudent } from "./ranking";
import { validatePlan } from "./validate";

// 2031-07-11 is a TUESDAY in the case-study calendar (weekday 2); 2031-07-12 is a Wednesday (3).
const TUE = "2031-07-11";

const therapist = (id: number, name: string, rank: Therapist["rank"] = "BT"): Therapist => ({ id, name, rank, isPartTime: false, homeArea: null });
const session = (id: number, studentId: number, therapistId: number | null, extra: Partial<Session> = {}): Session => ({
  id,
  date: TUE,
  slot: "PM",
  startTime: "14:00",
  endTime: "17:30",
  location: "clinic",
  status: "scheduled",
  studentId,
  studentName: `Child ${studentId}`,
  therapistId,
  therapistName: null,
  originalTherapistId: null,
  cancelReason: null,
  parentStatus: null,
  ...extra,
});
const absent = (therapistId: number): Absence => ({
  id: therapistId, therapistId, therapistName: "", date: TUE, slot: null, type: "medical", note: null, reportedAt: "", botReportId: null,
});
const child = (id: number, team: number[] = []): EngineStudent => ({
  id, name: `Child ${id}`, plan: "Core", homeArea: null, team: new Set(team), blacklist: new Set(), history: new Set(),
});

let nextId = 1;
const rule = (r: Partial<PreferenceRule> & Pick<PreferenceRule, "type" | "therapistId">): PreferenceRule => ({
  id: nextId++,
  studentId: null,
  strength: "soft",
  status: "active",
  days: null,
  boundaryTime: null,
  appliesTo: null,
  effectiveFrom: null,
  effectiveTo: null,
  summary: "test rule",
  ...r,
});

const ABSENT = therapist(1, "Absent");
const TEAM = therapist(2, "Team T");
const OTHER = therapist(3, "Other O");
const therapists = [ABSENT, TEAM, OTHER];

describe("preferenceApplies", () => {
  const times = { studentId: 100, date: TUE, startTime: "14:00", endTime: "17:30" };

  it("matches a pairing only for that therapist and child", () => {
    const r = rule({ type: "pairing", therapistId: 2, studentId: 100 });
    expect(preferenceApplies(r, 2, times)).toBe(true);
    expect(preferenceApplies(r, 3, times)).toBe(false);
    expect(preferenceApplies(r, 2, { ...times, studentId: 101 })).toBe(false);
  });

  it("uses the actual session END for end-boundaries (still running after the time)", () => {
    const r = rule({ type: "time_unavailable", therapistId: 2, days: [2], boundaryTime: "17:00", appliesTo: "end" });
    expect(preferenceApplies(r, 2, times)).toBe(true); // 14:00–17:30 runs past 17:00
    expect(preferenceApplies(r, 2, { ...times, endTime: "17:00" })).toBe(false); // ends exactly at 17:00
    expect(preferenceApplies(r, 2, { ...times, startTime: "08:30", endTime: "12:00" })).toBe(false);
  });

  it("uses the actual session START for start-boundaries", () => {
    const r = rule({ type: "time_unavailable", therapistId: 2, days: [2], boundaryTime: "17:00", appliesTo: "start" });
    expect(preferenceApplies(r, 2, times)).toBe(false); // a PM session starting 14:00 is NOT caught by "starts after 5pm"
    expect(preferenceApplies(r, 2, { ...times, startTime: "17:00", endTime: "18:00" })).toBe(true);
  });

  it("only applies on the listed days (case-study calendar) and inside the effective dates", () => {
    const r = rule({ type: "time_unavailable", therapistId: 2, days: [1, 3, 5], boundaryTime: "17:00", appliesTo: "end" });
    expect(preferenceApplies(r, 2, times)).toBe(false); // Tuesday
    expect(preferenceApplies(r, 2, { ...times, date: "2031-07-12" })).toBe(true); // Wednesday

    const dated = rule({ type: "pairing", therapistId: 2, studentId: 100, effectiveFrom: "2031-07-12", effectiveTo: "2031-07-20" });
    expect(preferenceApplies(dated, 2, times)).toBe(false);
    expect(preferenceApplies(dated, 2, { ...times, date: "2031-07-15" })).toBe(true);
    expect(preferenceApplies(dated, 2, { ...times, date: "2031-07-21" })).toBe(false);
  });

  it("never applies an incomplete time rule", () => {
    const r = rule({ type: "time_unavailable", therapistId: 2, days: [2], boundaryTime: "17:00", appliesTo: null });
    expect(preferenceApplies(r, 2, times)).toBe(false);
  });

  it("ignores anything that isn't active (suggested, paused, rejected, removed)", () => {
    for (const status of ["suggested", "paused", "rejected", "removed"] as const) {
      const r = rule({ type: "pairing", therapistId: 2, studentId: 100, strength: "hard", status });
      expect(matchingRules([r], 2, times).hard).toHaveLength(0);
    }
  });

  it("describes rules in plain language", () => {
    expect(
      summarizePreference({ type: "time_unavailable", strength: "hard", therapistName: "Jade", studentName: null, days: [1, 3, 5], boundaryTime: "17:00", appliesTo: "end", effectiveFrom: null, effectiveTo: null }),
    ).toBe("Jade can't take sessions running past 5:00 pm on Mon, Wed, Fri");
  });
});

describe("engine with preferences", () => {
  const base = {
    sessions: [session(10, 100, 1)],
    absences: [absent(1)],
    therapists,
    students: new Map([[100, child(100, [2])]]),
  };

  it("a confirmed HARD rule removes the candidate, even a team member, and says so", () => {
    const hard = rule({ type: "pairing", therapistId: 2, studentId: 100, strength: "hard", summary: "Never assign Team T to Child 100" });
    const [p] = proposeReallocations({ ...base, preferences: [hard] }).primary;
    expect(p.toTherapistId).toBe(3);
    expect(p.rationale.join(" ")).toMatch(/Never assign Team T to Child 100 — Team T not considered/);
  });

  it("a HARD rule can leave a session with no candidate (cancel) — it is a constraint", () => {
    const hard2 = rule({ type: "pairing", therapistId: 2, studentId: 100, strength: "hard" });
    const hard3 = rule({ type: "pairing", therapistId: 3, studentId: 100, strength: "hard" });
    const [p] = proposeReallocations({ ...base, preferences: [hard2, hard3] }).primary;
    expect(p.toTherapistId).toBeNull();
  });

  it("a SOFT rule beats the team ranking when another therapist is free", () => {
    const soft = rule({ type: "pairing", therapistId: 2, studentId: 100, summary: "Avoid Team T for Child 100" });
    const [p] = proposeReallocations({ ...base, preferences: [soft] }).primary;
    expect(p.toTherapistId).toBe(3);
    expect(p.rationale.join(" ")).toMatch(/Avoid Team T for Child 100 — Team T avoided/);
  });

  it("a SOFT rule is overridden (with a warning) rather than cancelling the session", () => {
    const soft = rule({ type: "pairing", therapistId: 2, studentId: 100, summary: "Avoid Team T for Child 100" });
    const [p] = proposeReallocations({
      ...base,
      therapists: [ABSENT, TEAM], // nobody else is free
      preferences: [soft],
    }).primary;
    expect(p.toTherapistId).toBe(2);
    expect(p.rationale.join(" ")).toMatch(/⚠ Overrides Rule #\d+ \(avoid\): Avoid Team T for Child 100/);
  });

  it("soft rules never increase cancellations across a slot", () => {
    // Two children need cover, two therapists free; both therapists are soft-avoided for child 100.
    const prefs = [
      rule({ type: "pairing", therapistId: 2, studentId: 100 }),
      rule({ type: "pairing", therapistId: 3, studentId: 100 }),
    ];
    const four = therapist(4, "Absent 2");
    const { primary } = proposeReallocations({
      sessions: [session(10, 100, 1), session(11, 101, 4)],
      absences: [absent(1), absent(4)],
      therapists: [...therapists, four],
      students: new Map([[100, child(100)], [101, child(101)]]),
      preferences: prefs,
    });
    expect(primary.every((p) => p.toTherapistId !== null)).toBe(true);
  });

  it("a time rule uses the session's actual end time", () => {
    const late = rule({ type: "time_unavailable", therapistId: 2, strength: "hard", days: [2], boundaryTime: "17:00", appliesTo: "end" });
    const runsLate = proposeReallocations({ ...base, preferences: [late] }).primary[0];
    expect(runsLate.toTherapistId).toBe(3);
    const early = proposeReallocations({
      ...base,
      sessions: [session(10, 100, 1, { startTime: "14:00", endTime: "16:30" })],
      preferences: [late],
    }).primary[0];
    expect(early.toTherapistId).toBe(2); // ends before 17:00 → rule doesn't apply → team member wins
  });

  it("pending SUGGESTIONS never affect proposals", () => {
    const suggested = rule({ type: "pairing", therapistId: 2, studentId: 100, strength: "hard", status: "suggested" });
    const [p] = proposeReallocations({ ...base, preferences: [suggested] }).primary;
    expect(p.toTherapistId).toBe(2);
  });
});

describe("validation and candidates with preferences", () => {
  const ctx = {
    sessions: [session(10, 100, 1)],
    absences: [absent(1)],
    therapists,
    students: new Map([[100, child(100, [2])]]),
  };

  it("assigning a HARD-ruled therapist is a validation error; a SOFT one is a warning", () => {
    const hard = rule({ type: "pairing", therapistId: 2, studentId: 100, strength: "hard" });
    const soft = rule({ type: "pairing", therapistId: 3, studentId: 100 });
    const hardIssues = validatePlan({ ...ctx, preferences: [hard, soft], assignments: [{ id: 1, sessionId: 10, toTherapistId: 2 }] });
    expect(hardIssues.some((i) => i.level === "error" && /breaks confirmed Rule/.test(i.message))).toBe(true);
    const softIssues = validatePlan({ ...ctx, preferences: [hard, soft], assignments: [{ id: 1, sessionId: 10, toTherapistId: 3 }] });
    expect(softIssues.filter((i) => i.level === "error")).toHaveLength(0);
    expect(softIssues.some((i) => i.level === "warning" && /goes against confirmed Rule/.test(i.message))).toBe(true);
  });

  it("candidates: hard → unavailable with the rule as reason; soft → avoided and listed last", () => {
    const hard = rule({ type: "pairing", therapistId: 2, studentId: 100, strength: "hard", summary: "Never assign Team T to Child 100" });
    const soft = rule({ type: "pairing", therapistId: 3, studentId: 100 });
    const four = therapist(4, "Fourth F");
    const assignment = {
      id: 1, planId: 1, sessionId: 10, slot: "PM", startTime: "14:00", endTime: "17:30", studentId: 100,
      toTherapistId: null, rejectedTherapistIds: [],
    } as unknown as PlanAssignment;
    const list = candidatesForAssignment(assignment, [assignment], { ...ctx, therapists: [...therapists, four], preferences: [hard, soft] });
    const byId = new Map(list.map((c) => [c.therapistId, c]));
    expect(byId.get(2)).toMatchObject({ available: false });
    expect(byId.get(2)!.unavailableReason).toMatch(/Never assign Team T/);
    expect(byId.get(3)).toMatchObject({ available: true, avoided: true });
    expect(list.filter((c) => c.available).map((c) => c.therapistId)).toEqual([4, 3]);
  });
});
