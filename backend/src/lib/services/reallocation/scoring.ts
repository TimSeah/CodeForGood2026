import { SENIOR_RANKS, type Therapist } from "@/lib/types";

// Soft-preference weights for ranking replacement therapists. Tune these freely —
// hard constraints (availability, home/school rule) live in engine.ts, not here.
export const WEIGHTS = {
  /** Already on the child's team → child knows them, continuity of care. */
  onTeam: 100,
  /** Child normally has a senior therapist and the candidate is also senior. */
  seniorForSenior: 30,
  /** Child normally has a senior therapist but the candidate is junior (allowed, but worse). */
  juniorForSenior: -20,
} as const;

export interface CandidateScore {
  therapistId: number;
  score: number;
  reasons: string[];
}

export const isSenior = (t: Pick<Therapist, "rank">) => SENIOR_RANKS.includes(t.rank);

export function scoreCandidate(args: {
  candidate: Therapist;
  original: Therapist | null;
  teamTherapistIds: ReadonlySet<number>;
}): CandidateScore {
  const { candidate, original, teamTherapistIds } = args;
  let score = 0;
  const reasons: string[] = [];

  if (teamTherapistIds.has(candidate.id)) {
    score += WEIGHTS.onTeam;
    reasons.push("Already on the child's team");
  }
  if (original && isSenior(original)) {
    if (isSenior(candidate)) {
      score += WEIGHTS.seniorForSenior;
      reasons.push(`Senior → senior (${original.rank} → ${candidate.rank})`);
    } else {
      score += WEIGHTS.juniorForSenior;
      reasons.push(`Junior covering a senior's case (${original.rank} → ${candidate.rank})`);
    }
  }
  // TODO: travel distance (homeArea), part-time hours, historical familiarity, therapist preferences.
  return { therapistId: candidate.id, score, reasons };
}
