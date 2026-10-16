import type { Absence, Session, Slot, Therapist } from "@/lib/types";
import { scoreCandidate } from "./scoring";

// PURE matching logic: no DB, no I/O. Everything it needs is passed in, so it is easy to unit test
// (see engine.test.ts) and easy to swap for a smarter optimiser later.

export interface EngineInput {
  sessions: Session[]; // all sessions for ONE date
  absences: Absence[]; // all absences for that date
  therapists: Therapist[];
  /** studentId → therapist ids on that child's team */
  teams: Map<number, Set<number>>;
}

export interface Proposal {
  sessionId: number;
  fromTherapistId: number | null;
  /** null = cancel the session */
  toTherapistId: number | null;
  score: number | null;
  rationale: string[];
}

const isAbsent = (absences: Absence[], therapistId: number, slot: Slot) =>
  absences.some((a) => a.therapistId === therapistId && (a.slot === null || a.slot === slot));

export function proposeReallocations({ sessions, absences, therapists, teams }: EngineInput): Proposal[] {
  const byId = new Map(therapists.map((t) => [t.id, t]));
  const live = sessions.filter((s) => s.status === "scheduled");

  // Who is already busy in each slot (cancelled sessions free their therapist up).
  const busy: Record<Slot, Set<number>> = { AM: new Set(), PM: new Set() };
  for (const s of live) if (s.therapistId !== null) busy[s.slot].add(s.therapistId);

  const affected = live.filter((s) => s.therapistId !== null && isAbsent(absences, s.therapistId, s.slot));

  // Hardest-to-fill first: children with the smallest teams get first pick of familiar therapists.
  // TODO: smarter ordering / global optimisation (e.g. allow chained swaps to avoid cancellations).
  affected.sort((a, b) => (teams.get(a.studentId)?.size ?? 0) - (teams.get(b.studentId)?.size ?? 0));

  const proposals: Proposal[] = [];
  for (const session of affected) {
    const original = byId.get(session.therapistId!) ?? null;
    const base = { sessionId: session.id, fromTherapistId: session.therapistId };

    // Hard rule: only the designated therapist may run home or school (shadow) sessions.
    if (session.location !== "clinic") {
      proposals.push({
        ...base,
        toTherapistId: null,
        score: null,
        rationale: [`${session.location} session: only the designated therapist can run it, so it must be cancelled`],
      });
      continue;
    }

    const team = teams.get(session.studentId) ?? new Set<number>();
    const candidates = therapists
      .filter((t) => !busy[session.slot].has(t.id) && !isAbsent(absences, t.id, session.slot))
      .map((candidate) => scoreCandidate({ candidate, original, teamTherapistIds: team }))
      .sort((a, b) => b.score - a.score || byId.get(a.therapistId)!.name.localeCompare(byId.get(b.therapistId)!.name));

    const best = candidates[0];
    if (!best) {
      proposals.push({ ...base, toTherapistId: null, score: null, rationale: [`No therapist free in the ${session.slot} slot`] });
      continue;
    }
    busy[session.slot].add(best.therapistId);
    proposals.push({
      ...base,
      toTherapistId: best.therapistId,
      score: best.score,
      rationale: best.reasons.length ? best.reasons : ["Available in this slot"],
    });
  }
  return proposals;
}
