import { type CasePlan, type PlanStep, SENIOR_RANKS, type Therapist } from "@/lib/types";
import { distanceKm } from "./distance";

// The rule hierarchy for picking a replacement (docs/plans/rescheduling.md). PURE — no DB access.

export interface EngineConfig {
  /** true = home/school sessions can only be run by the designated therapist (else cancel). Pending confirmation
   *  from Autism Partnership; default false = treat them like clinic sessions. */
  designatedOnlyForHomeSchool: boolean;
  /** When to offer a chain-swap alternative plan. "cancellation" = only if it avoids a cancellation (agreed rule);
   *  "fallback" = also if it avoids an out-of-tier ("any") or blacklisted match. */
  swapTrigger: "cancellation" | "fallback";
}

export const ENGINE_CONFIG: EngineConfig = {
  designatedOnlyForHomeSchool: false,
  swapTrigger: "cancellation",
};

/** What the engine needs to know about a child. */
export interface EngineStudent {
  id: number;
  name: string;
  plan: CasePlan | null;
  homeArea: string | null;
  team: ReadonlySet<number>;
  blacklist: ReadonlySet<number>;
  /** Therapists who covered this child before (session logs / past reassignments). */
  history: ReadonlySet<number>;
}

/** Lower = better. Order of the user-agreed rules. */
export const STEP_RANK: Record<PlanStep, number> = {
  team: 1,
  tier: 2,
  history: 3,
  any: 4,
  blacklisted: 5,
  manual: 6,
  swap: 7,
  cancel: 9,
};

export const isSenior = (t: Pick<Therapist, "rank">) => SENIOR_RANKS.includes(t.rank);

/** Core → juniors, Specialised → seniors, Advanced (or unknown) → anyone. */
export function fitsTier(t: Pick<Therapist, "rank">, plan: CasePlan | null): boolean {
  if (plan === "Core") return !isSenior(t);
  if (plan === "Specialised") return isSenior(t);
  return true;
}

export interface RankedCandidate {
  therapistId: number;
  step: Exclude<PlanStep, "swap" | "cancel" | "manual">;
  distanceKm: number | null;
  reasons: string[];
}

export function classify(t: Therapist, s: EngineStudent): RankedCandidate {
  const km = distanceKm(t.homeArea, s.homeArea);
  const dist = km === null ? [] : [`${km} km from ${s.name}'s home (${t.homeArea} → ${s.homeArea})`];
  const tierNote = `${t.rank} ${fitsTier(t, s.plan) ? "fits" : "is outside"} ${s.name}'s ${s.plan ?? "unknown"} plan`;

  let step: RankedCandidate["step"];
  let reasons: string[];
  if (s.blacklist.has(t.id)) {
    step = "blacklisted";
    reasons = [`On ${s.name}'s blacklist (parents not comfortable) — last resort`];
  } else if (s.team.has(t.id)) {
    step = "team";
    reasons = [`On ${s.name}'s team`];
  } else if (fitsTier(t, s.plan)) {
    step = "tier";
    reasons = s.history.has(t.id) ? [tierNote, `Has covered ${s.name} before`] : [tierNote];
  } else if (s.history.has(t.id)) {
    step = "history";
    reasons = [`Has covered ${s.name} before`, tierNote];
  } else {
    step = "any";
    reasons = [`Not on team, no history with ${s.name}`, tierNote];
  }
  return { therapistId: t.id, step, distanceKm: km, reasons: [...reasons, ...dist] };
}

/** Sort: rule step, then distance (unknown distance last), then name for stable output. */
export function rankCandidates(candidates: Therapist[], s: EngineStudent): RankedCandidate[] {
  const names = new Map(candidates.map((t) => [t.id, t.name]));
  return candidates
    .map((t) => classify(t, s))
    .sort(
      (a, b) =>
        STEP_RANK[a.step] - STEP_RANK[b.step] ||
        (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity) ||
        names.get(a.therapistId)!.localeCompare(names.get(b.therapistId)!),
    );
}
