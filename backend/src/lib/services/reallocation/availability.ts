import type { Absence, Session, Slot } from "@/lib/types";

export const isAbsent = (absences: Absence[], therapistId: number, slot: Slot) =>
  absences.some((a) => a.therapistId === therapistId && (a.slot === null || a.slot === slot));

/**
 * Sessions that need a new therapist: scheduled, and either their therapist is away in that slot or they have
 * no therapist (a parent declined the substitute, so the session was handed back for re-planning).
 */
export function affectedSessions(sessions: Session[], absences: Absence[]): Session[] {
  return sessions.filter(
    (s) => s.status === "scheduled" && (s.therapistId === null || isAbsent(absences, s.therapistId, s.slot)),
  );
}

/** Therapists booked in each slot (cancelled sessions free their therapist up). */
export function busyBySlot(sessions: Session[]): Record<Slot, Set<number>> {
  const busy: Record<Slot, Set<number>> = { AM: new Set(), PM: new Set() };
  for (const s of sessions) if (s.status === "scheduled" && s.therapistId !== null) busy[s.slot].add(s.therapistId);
  return busy;
}
