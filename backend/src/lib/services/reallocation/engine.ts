import type { Absence, PlanStep, Session, Therapist } from "@/lib/types";
import { affectedSessions, busyBySlot, isAbsent } from "./availability";
import { minCostAssignment } from "./hungarian";
import { ENGINE_CONFIG, type EngineConfig, type EngineStudent, type RankedCandidate, rankCandidates } from "./ranking";
import { findSwapAlternative } from "./swaps";

// PURE matching logic: no DB, no I/O. Everything it needs is passed in, so it is easy to unit test
// (see engine.test.ts) and easy to swap for a smarter optimiser later.

export interface EngineInput {
  sessions: Session[]; // all sessions for ONE date
  absences: Absence[]; // all absences for that date (including "off" rostering)
  therapists: Therapist[];
  students: Map<number, EngineStudent>;
  /** sessionId → therapists that must not be proposed (e.g. the parent declined them). */
  exclusions?: Map<number, Set<number>>;
  config?: Partial<EngineConfig>;
}

export interface ProposedAssignment {
  sessionId: number;
  fromTherapistId: number | null;
  /** null = cancel */
  toTherapistId: number | null;
  step: PlanStep;
  distanceKm: number | null;
  rationale: string[];
  chainId: string | null;
}

export interface EngineResult {
  primary: ProposedAssignment[];
  /** Separate plan using chain swaps, offered only when it beats the primary (see ENGINE_CONFIG.swapTrigger). */
  swapAlternative: ProposedAssignment[] | null;
}

// Costs for the optimal assignment. Gaps are large enough that the rule order dominates distance (< 100 km in
// Singapore) and one cancellation outweighs every child getting a blacklisted therapist.
const STEP_COST: Record<RankedCandidate["step"], number> = {
  team: 0,
  tier: 1_000,
  history: 2_000,
  any: 3_000,
  blacklisted: 100_000,
};
const DISTANCE_UNKNOWN_KM = 50;
const CANCEL_COST = 10_000_000;
const IMPOSSIBLE = 1_000_000_000;

export function proposeReallocations(input: EngineInput): EngineResult {
  const config = { ...ENGINE_CONFIG, ...input.config };
  const { therapists, students, absences } = input;
  const exclusions = input.exclusions ?? new Map<number, Set<number>>();
  const busy = busyBySlot(input.sessions);

  const affected = affectedSessions(input.sessions, absences);

  const freeFor = (session: Session) =>
    therapists.filter(
      (t) =>
        !busy[session.slot].has(t.id) &&
        !isAbsent(absences, t.id, session.slot) &&
        !exclusions.get(session.id)?.has(t.id),
    );

  const base = (s: Session) => ({
    sessionId: s.id,
    fromTherapistId: s.therapistId ?? s.originalTherapistId,
    chainId: null,
  });
  const decided = new Map<number, ProposedAssignment>();

  // Hard rule (optional): home/school sessions need their designated therapist.
  const open = affected.filter((s) => {
    if (!(config.designatedOnlyForHomeSchool && s.location !== "clinic")) return true;
    decided.set(s.id, {
      ...base(s),
      toTherapistId: null,
      step: "cancel",
      distanceKm: null,
      rationale: [`${s.location} session: only the designated therapist may run it`],
    });
    return false;
  });

  // Optimal assignment per slot (AM and PM are independent). Minimises total cost, where a cancellation costs
  // more than any combination of matches ("any therapist is better than no therapist"), then the agreed rule
  // order (team < tier < history < any < blacklisted), then distance.
  for (const slot of ["AM", "PM"] as const) {
    const rows = open.filter((s) => s.slot === slot);
    if (rows.length === 0) continue;
    const pool = therapists.filter((t) => !busy[slot].has(t.id) && !isAbsent(absences, t.id, slot));
    const ranked = rows.map((s) => {
      const byTherapist = new Map(rankCandidates(freeFor(s), students.get(s.studentId)!).map((c) => [c.therapistId, c]));
      return pool.map((t) => byTherapist.get(t.id) ?? null); // null = excluded for this session
    });
    // Columns: every free therapist, then one "cancel" column per session.
    const cost = ranked.map((cands) => [
      ...cands.map((c) => (c ? STEP_COST[c.step] + (c.distanceKm ?? DISTANCE_UNKNOWN_KM) : IMPOSSIBLE)),
      ...rows.map(() => CANCEL_COST),
    ]);
    minCostAssignment(cost).forEach((col, i) => {
      const c = col < pool.length ? ranked[i][col] : null;
      if (!c) return; // cancel column → handled below
      busy[slot].add(c.therapistId);
      decided.set(rows[i].id, { ...base(rows[i]), toTherapistId: c.therapistId, step: c.step, distanceKm: c.distanceKm, rationale: c.reasons });
    });
  }

  // Anything left: more children need cover in that slot than there are free therapists.
  for (const s of open) {
    if (decided.has(s.id)) continue;
    const hadOptions = freeFor(s).length > 0;
    decided.set(s.id, {
      ...base(s),
      toTherapistId: null,
      step: "cancel",
      distanceKm: null,
      rationale: [
        hadOptions
          ? `Every free therapist in the ${s.slot} slot is covering another child`
          : `No therapist is free in the ${s.slot} slot`,
      ],
    });
  }

  const primary = affected.map((s) => decided.get(s.id)!);

  const swapAlternative = findSwapAlternative({ ...input, config, primary, busy });
  return { primary, swapAlternative };
}
