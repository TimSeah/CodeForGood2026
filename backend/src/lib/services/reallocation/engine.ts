import type { Absence, PlanStep, Session, Therapist } from "@/lib/types";
import { affectedSessions, busyBySlot, isAbsent } from "./availability";
import { minCostAssignment } from "./hungarian";
import { activeRules, matchingRules, type PreferenceRule, ruleLabel } from "./preferences";
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
  /** Admin-confirmed scheduling preferences. Only status "active" is applied (suggestions never are). */
  preferences?: PreferenceRule[];
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

// Costs for the optimal assignment, lexicographic by design (a slot has ≤ ~30 sessions):
//   cancellations  >>  soft-preference conflicts  >>  rule order (team … blacklisted)  >>  distance
// One cancellation (1e10) outweighs every session breaking a soft preference (30 × 1e7); one soft conflict (1e7)
// outweighs every session getting the worst ranking (30 × ~1e5). So soft preferences never cause a cancellation.
const STEP_COST: Record<RankedCandidate["step"], number> = {
  team: 0,
  tier: 1_000,
  history: 2_000,
  any: 3_000,
  blacklisted: 100_000,
};
const DISTANCE_UNKNOWN_KM = 50;
const SOFT_PREFERENCE_COST = 10_000_000;
const CANCEL_COST = 10_000_000_000;
const IMPOSSIBLE = 10_000_000_000_000;

export function proposeReallocations(input: EngineInput): EngineResult {
  const config = { ...ENGINE_CONFIG, ...input.config };
  const { therapists, students, absences } = input;
  const exclusions = input.exclusions ?? new Map<number, Set<number>>();
  const busy = busyBySlot(input.sessions);

  const affected = affectedSessions(input.sessions, absences);

  const preferences = activeRules(input.preferences);
  const rulesFor = (therapistId: number, s: Session) => matchingRules(preferences, therapistId, s);

  // Free for this session, ignoring preferences (used to explain which preferences shaped the choice).
  const openFor = (session: Session) =>
    therapists.filter(
      (t) =>
        !busy[session.slot].has(t.id) &&
        !isAbsent(absences, t.id, session.slot) &&
        !exclusions.get(session.id)?.has(t.id),
    );
  // Confirmed HARD preferences remove a candidate outright.
  const freeFor = (session: Session) => openFor(session).filter((t) => rulesFor(t.id, session).hard.length === 0);

  /** Rationale lines: which confirmed preferences kept someone out, or had to be overridden. */
  const preferenceNotes = (s: Session, chosenId: number | null, candidates: Therapist[]) => {
    const notes: string[] = [];
    if (chosenId !== null) {
      for (const r of rulesFor(chosenId, s).soft) {
        notes.push(`⚠ Overrides ${ruleLabel(r)}: ${r.summary} — no other suitable therapist was free, and cancelling is worse`);
      }
    }
    for (const t of candidates) {
      if (t.id === chosenId) continue;
      const { hard, soft } = rulesFor(t.id, s);
      for (const r of hard) notes.push(`${ruleLabel(r)}: ${r.summary} — ${t.name} not considered`);
      for (const r of soft) notes.push(`${ruleLabel(r)}: ${r.summary} — ${t.name} avoided`);
    }
    return notes;
  };

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
    const cost = ranked.map((cands, i) => [
      ...cands.map((c) =>
        c
          ? (rulesFor(c.therapistId, rows[i]).soft.length ? SOFT_PREFERENCE_COST : 0) +
            STEP_COST[c.step] +
            (c.distanceKm ?? DISTANCE_UNKNOWN_KM)
          : IMPOSSIBLE,
      ),
      ...rows.map(() => CANCEL_COST),
    ]);
    minCostAssignment(cost).forEach((col, i) => {
      const c = col < pool.length ? ranked[i][col] : null;
      if (!c) return; // cancel column → handled below
      busy[slot].add(c.therapistId);
      decided.set(rows[i].id, {
        ...base(rows[i]),
        toTherapistId: c.therapistId,
        step: c.step,
        distanceKm: c.distanceKm,
        rationale: [...c.reasons, ...preferenceNotes(rows[i], c.therapistId, openFor(rows[i]))],
      });
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
        ...preferenceNotes(s, null, openFor(s)),
      ],
    });
  }

  const primary = affected.map((s) => decided.get(s.id)!);

  const swapAlternative = findSwapAlternative({ ...input, config, primary, busy });
  return { primary, swapAlternative };
}
