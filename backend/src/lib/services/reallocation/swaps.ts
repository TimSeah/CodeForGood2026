import type { Slot } from "@/lib/types";
import { affectedSessions, isAbsent } from "./availability";
import type { EngineInput, ProposedAssignment } from "./engine";
import { matchingRules } from "./preferences";
import { classify, type EngineConfig, STEP_RANK } from "./ranking";

// Chain swaps: free therapist A covers child B, so B's therapist (B) can move to child C.
// Never part of the primary plan — returned as a separate alternative for the admin to choose,
// and only when it improves on the primary for at least one session (see EngineConfig.swapTrigger).

interface SwapInput extends EngineInput {
  config: EngineConfig;
  primary: ProposedAssignment[];
  /** Busy sets AFTER the primary plan's assignments. */
  busy: Record<Slot, Set<number>>;
}

export function findSwapAlternative(input: SwapInput): ProposedAssignment[] | null {
  const { config, primary, therapists, students, absences, sessions } = input;
  // A swap must not create any conflict with a confirmed preference (hard or soft).
  const conflicts = (therapistId: number, s: (typeof sessions)[number]) => {
    const r = matchingRules(input.preferences, therapistId, s);
    return r.hard.length + r.soft.length > 0;
  };
  const exclusions = input.exclusions ?? new Map<number, Set<number>>();
  const byId = new Map(therapists.map((t) => [t.id, t]));
  const sessionById = new Map(sessions.map((s) => [s.id, s]));
  const affectedIds = new Set(affectedSessions(sessions, absences).map((s) => s.id));

  const triggers: ReadonlySet<string> =
    config.swapTrigger === "fallback" ? new Set(["cancel", "any", "blacklisted"]) : new Set(["cancel"]);
  const targets = primary.filter(
    // Cancellations forced by the designated-therapist rule can't be fixed by swapping.
    (p) => triggers.has(p.step) && !(p.step === "cancel" && p.rationale[0]?.includes("designated")),
  );
  if (targets.length === 0) return null;

  const busy: Record<Slot, Set<number>> = { AM: new Set(input.busy.AM), PM: new Set(input.busy.PM) };
  const movedSessions = new Set<number>();
  const result = new Map(primary.map((p) => [p.sessionId, p]));
  const extra: ProposedAssignment[] = [];
  let chains = 0;

  for (const target of targets) {
    const sessionC = sessionById.get(target.sessionId)!;
    const childC = students.get(sessionC.studentId)!;
    const slot = sessionC.slot;
    // The primary's fallback therapist for C (if any) would be released by the swap, so they count as free.
    const freeA = therapists.filter(
      (t) => (t.id === target.toTherapistId || !busy[slot].has(t.id)) && !isAbsent(absences, t.id, slot),
    );

    let best: { sessionB: (typeof sessions)[number]; bForC: ReturnType<typeof classify>; aForB: ReturnType<typeof classify> } | null =
      null;
    for (const sessionB of sessions) {
      if (sessionB.slot !== slot || sessionB.status !== "scheduled" || sessionB.therapistId === null) continue;
      if (affectedIds.has(sessionB.id) || movedSessions.has(sessionB.id)) continue;
      if (config.designatedOnlyForHomeSchool && (sessionB.location !== "clinic" || sessionC.location !== "clinic")) continue;
      const therapistB = byId.get(sessionB.therapistId)!;
      if (exclusions.get(sessionC.id)?.has(therapistB.id) || conflicts(therapistB.id, sessionC)) continue;

      const bForC = classify(therapistB, childC);
      if (STEP_RANK[bForC.step] >= STEP_RANK[target.step] || STEP_RANK[bForC.step] > STEP_RANK.history) continue;

      // Child B must keep a good (team/tier/history) match, so the swap doesn't just move the problem.
      const childB = students.get(sessionB.studentId)!;
      for (const a of freeA) {
        if (exclusions.get(sessionB.id)?.has(a.id) || conflicts(a.id, sessionB)) continue;
        const aForB = classify(a, childB);
        if (STEP_RANK[aForB.step] > STEP_RANK.history) continue;
        const better =
          !best ||
          STEP_RANK[bForC.step] < STEP_RANK[best.bForC.step] ||
          (STEP_RANK[bForC.step] === STEP_RANK[best.bForC.step] && STEP_RANK[aForB.step] < STEP_RANK[best.aForB.step]);
        if (better) best = { sessionB, bForC, aForB };
      }
    }
    if (!best) continue;

    const chainId = `swap-${++chains}`;
    const nameA = byId.get(best.aForB.therapistId)!.name;
    const nameB = byId.get(best.bForC.therapistId)!.name;
    // The primary's fallback therapist for C (if any) is released back into the pool.
    if (target.toTherapistId !== null) busy[slot].delete(target.toTherapistId);
    busy[slot].add(best.aForB.therapistId);
    movedSessions.add(best.sessionB.id);

    result.set(target.sessionId, {
      ...target,
      toTherapistId: best.bForC.therapistId,
      step: "swap",
      distanceKm: best.bForC.distanceKm,
      chainId,
      rationale: [`Swap: ${nameB} moves from ${best.sessionB.studentName} to ${childC.name}`, ...best.bForC.reasons],
    });
    extra.push({
      sessionId: best.sessionB.id,
      fromTherapistId: best.sessionB.therapistId,
      toTherapistId: best.aForB.therapistId,
      step: "swap",
      distanceKm: best.aForB.distanceKm,
      chainId,
      rationale: [`Swap: ${nameA} covers ${best.sessionB.studentName} so ${nameB} can take ${childC.name}`, ...best.aForB.reasons],
    });
  }

  return extra.length ? [...result.values(), ...extra] : null;
}
