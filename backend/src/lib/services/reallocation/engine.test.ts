import { describe, expect, it } from "vitest";
import type { Absence, CasePlan, Session, Therapist } from "@/lib/types";
import { type EngineInput, proposeReallocations } from "./engine";
import type { EngineStudent } from "./ranking";
import { validatePlan } from "./validate";

// ---- fixtures -------------------------------------------------------------------------------------

const therapist = (id: number, name: string, rank: Therapist["rank"], homeArea: string | null = null): Therapist => ({
  id,
  name,
  rank,
  isPartTime: false,
  homeArea,
});

const session = (id: number, studentId: number, therapistId: number | null, extra: Partial<Session> = {}): Session => ({
  id,
  date: "2031-07-11",
  slot: "AM",
  startTime: "08:30",
  endTime: "12:00",
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

const absent = (therapistId: number, slot: Absence["slot"] = null): Absence => ({
  id: therapistId,
  therapistId,
  therapistName: "",
  date: "2031-07-11",
  slot,
  type: "medical",
  note: null,
  reportedAt: "",
  botReportId: null,
});

const child = (
  id: number,
  plan: CasePlan,
  opts: { team?: number[]; blacklist?: number[]; history?: number[]; homeArea?: string } = {},
): EngineStudent => ({
  id,
  name: `Child ${id}`,
  plan,
  homeArea: opts.homeArea ?? null,
  team: new Set(opts.team ?? []),
  blacklist: new Set(opts.blacklist ?? []),
  history: new Set(opts.history ?? []),
});

const SENIOR_A = therapist(1, "Senior A", "SBT", "Tampines");
const SENIOR_B = therapist(2, "Senior B", "LBT", "Clementi");
const JUNIOR_C = therapist(3, "Junior C", "PT", "Bedok");
const JUNIOR_D = therapist(4, "Junior D", "BT", "Jurong West");

const run = (input: Partial<EngineInput> & Pick<EngineInput, "sessions" | "students">) =>
  proposeReallocations({ absences: [], therapists: [SENIOR_A, SENIOR_B, JUNIOR_C, JUNIOR_D], ...input });

const only = <T>(xs: T[]) => {
  expect(xs).toHaveLength(1);
  return xs[0];
};

// ---- rules ----------------------------------------------------------------------------------------

describe("proposeReallocations — rule order", () => {
  it("1. prefers a free therapist on the child's team, even over a better tier fit", () => {
    const p = only(
      run({
        sessions: [session(10, 100, 1)],
        absences: [absent(1)],
        students: new Map([[100, child(100, "Specialised", { team: [1, 3] })]]),
      }).primary,
    );
    expect(p.toTherapistId).toBe(3);
    expect(p.step).toBe("team");
  });

  it("2. then the tier: Core → junior, Specialised → senior", () => {
    const core = only(
      run({ sessions: [session(10, 100, 1)], absences: [absent(1)], students: new Map([[100, child(100, "Core")]]) }).primary,
    );
    expect([3, 4]).toContain(core.toTherapistId);
    expect(core.step).toBe("tier");

    const specialised = only(
      run({ sessions: [session(10, 100, 3)], absences: [absent(3)], students: new Map([[100, child(100, "Specialised")]]) })
        .primary,
    );
    expect([1, 2]).toContain(specialised.toTherapistId);
  });

  it("3. then someone who has covered the child before, 4. then anyone", () => {
    // Core child, only seniors free: Senior B has history, Senior A doesn't.
    const input = {
      sessions: [session(10, 100, 3), session(11, 101, 4)],
      absences: [absent(3)],
      therapists: [SENIOR_A, SENIOR_B, JUNIOR_C, JUNIOR_D],
      students: new Map([
        [100, child(100, "Core", { history: [2] })],
        [101, child(101, "Core")],
      ]),
    };
    expect(only(run(input).primary)).toMatchObject({ toTherapistId: 2, step: "history" });

    const noHistory = { ...input, students: new Map([...input.students, [100, child(100, "Core")]]) };
    expect(only(run(noHistory).primary).step).toBe("any");
  });

  it("5. blacklisted therapists come last, even if on the team — but beat cancelling", () => {
    const students = new Map([[100, child(100, "Core", { team: [3], blacklist: [3] })]]);
    const withOthers = only(run({ sessions: [session(10, 100, 4)], absences: [absent(4)], students }).primary);
    expect(withOthers.toTherapistId).not.toBe(3);

    const onlyBlacklisted = only(
      run({
        sessions: [session(10, 100, 4)],
        absences: [absent(4), absent(1), absent(2)],
        therapists: [SENIOR_A, SENIOR_B, JUNIOR_C, JUNIOR_D],
        students,
      }).primary,
    );
    expect(onlyBlacklisted).toMatchObject({ toTherapistId: 3, step: "blacklisted" });
  });

  it("ranks equally-good candidates by distance to the child's home", () => {
    // Core child in Tampines: Junior C (Bedok) is closer than Junior D (Jurong West).
    const p = only(
      run({
        sessions: [session(10, 100, 1)],
        absences: [absent(1)],
        students: new Map([[100, child(100, "Core", { homeArea: "Tampines" })]]),
      }).primary,
    );
    expect(p.toTherapistId).toBe(3);
    expect(p.distanceKm).toBeGreaterThan(0);
  });
});

describe("proposeReallocations — constraints", () => {
  it("never double-books, and cancels only when nobody is free", () => {
    const { primary } = run({
      sessions: [session(10, 100, 1), session(11, 101, 2), session(12, 102, 3), session(13, 103, 4)],
      absences: [absent(1), absent(2)],
      students: new Map([100, 101, 102, 103].map((id) => [id, child(id, "Advanced")])),
    });
    expect(primary.map((p) => p.step)).toEqual(["cancel", "cancel"]);
  });

  it("prefers covering every child over giving one child a team match (any therapist beats none)", () => {
    // Free: Junior C and Junior D. Child 100's team includes C. Child 101's parent declined D, so 101 can only
    // have C. A team-first greedy would give C to 100 and cancel 101; the optimiser gives 100 D instead.
    const { primary } = run({
      sessions: [session(10, 100, 1), session(11, 101, 2)],
      absences: [absent(1), absent(2)],
      therapists: [SENIOR_A, SENIOR_B, JUNIOR_C, JUNIOR_D],
      students: new Map([
        [100, child(100, "Core", { team: [3] })],
        [101, child(101, "Core")],
      ]),
      exclusions: new Map([[11, new Set([4])]]),
    });
    const bySession = new Map(primary.map((p) => [p.sessionId, p]));
    expect(bySession.get(10)?.toTherapistId).toBe(4);
    expect(bySession.get(11)?.toTherapistId).toBe(3);
  });

  it("only treats a half-day absence as affecting that slot", () => {
    const { primary } = run({
      sessions: [session(10, 100, 1, { slot: "AM" })],
      absences: [absent(1, "PM")],
      students: new Map([[100, child(100, "Advanced")]]),
    });
    expect(primary).toHaveLength(0);
  });

  it("re-plans a session with no therapist and skips excluded (declined) therapists", () => {
    const p = only(
      run({
        sessions: [session(10, 100, null, { originalTherapistId: 1 })],
        students: new Map([[100, child(100, "Core", { team: [3, 4] })]]),
        exclusions: new Map([[10, new Set([3])]]),
      }).primary,
    );
    expect(p).toMatchObject({ fromTherapistId: 1, toTherapistId: 4 });
  });

  it("home/school sessions are reassignable by default, cancelled when the designated-only flag is on", () => {
    const input = {
      sessions: [session(10, 100, 1, { location: "home" as const })],
      absences: [absent(1)],
      students: new Map([[100, child(100, "Advanced")]]),
    };
    expect(only(run(input).primary).toTherapistId).not.toBeNull();
    expect(only(run({ ...input, config: { designatedOnlyForHomeSchool: true } }).primary).step).toBe("cancel");
  });
});

describe("chain swaps", () => {
  // Child 100 (Specialised) loses Senior A. The only free therapist is Junior C (out of tier).
  // Senior B is busy with child 101 (Advanced) — Junior C can take 101, so B can move to 100.
  const input = {
    sessions: [session(10, 100, 1), session(11, 101, 2), session(12, 102, 4)],
    absences: [absent(1)],
    students: new Map([
      [100, child(100, "Specialised")],
      [101, child(101, "Advanced")],
      [102, child(102, "Core")],
    ]),
  };

  it("are not offered by default unless they avoid a cancellation", () => {
    const { primary, swapAlternative } = run(input);
    expect(only(primary)).toMatchObject({ toTherapistId: 3, step: "any" });
    expect(swapAlternative).toBeNull();
  });

  it("are offered as a separate plan with swapTrigger = fallback", () => {
    const { swapAlternative } = run({ ...input, config: { swapTrigger: "fallback" } });
    expect(swapAlternative).not.toBeNull();
    const bySession = new Map(swapAlternative!.map((a) => [a.sessionId, a]));
    expect(bySession.get(10)).toMatchObject({ toTherapistId: 2, step: "swap" });
    expect(bySession.get(11)).toMatchObject({ toTherapistId: 3, step: "swap" });
    expect(bySession.get(10)!.chainId).toBe(bySession.get(11)!.chainId);
  });
});

describe("validatePlan", () => {
  const ctx = {
    sessions: [session(10, 100, 1), session(11, 101, 3)],
    absences: [absent(1)],
    therapists: [SENIOR_A, SENIOR_B, JUNIOR_C, JUNIOR_D],
    students: new Map([
      [100, child(100, "Core", { blacklist: [4] })],
      [101, child(101, "Core")],
    ]),
  };

  it("errors on absent or double-booked therapists", () => {
    const absentIssue = validatePlan({ ...ctx, assignments: [{ id: 1, sessionId: 10, toTherapistId: 1 }] });
    expect(absentIssue.some((i) => i.level === "error" && i.message.includes("away"))).toBe(true);

    const clash = validatePlan({ ...ctx, assignments: [{ id: 1, sessionId: 10, toTherapistId: 3 }] });
    expect(clash.some((i) => i.level === "error" && i.message.includes("double-booked"))).toBe(true);
  });

  it("only warns on blacklist / tier / team mismatches", () => {
    const issues = validatePlan({ ...ctx, assignments: [{ id: 1, sessionId: 10, toTherapistId: 4 }] });
    expect(issues.filter((i) => i.level === "error")).toHaveLength(0);
    expect(issues.some((i) => i.message.includes("blacklist"))).toBe(true);
  });
});
