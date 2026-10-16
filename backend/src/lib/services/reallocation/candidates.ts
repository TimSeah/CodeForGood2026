import type { Absence, AssignmentCandidate, PlanAssignment, Session, Therapist } from "@/lib/types";
import { isAbsent } from "./availability";
import { matchingRules, type PreferenceRule, ruleLabel } from "./preferences";
import type { EngineStudent } from "./ranking";
import { classify, STEP_RANK } from "./ranking";

export interface CandidateContext {
  sessions: Session[];
  absences: Absence[];
  therapists: Therapist[];
  students: Map<number, EngineStudent>;
  exclusions?: Map<number, Set<number>>;
  /** Confirmed preferences (only "active" ones apply). */
  preferences?: PreferenceRule[];
}

/**
 * Ranks every therapist for one assignment against the schedule produced by the other assignments.
 * Both the HTTP candidate endpoint and the AI agent use this function so availability cannot drift.
 */
export function candidatesForAssignment(
  assignment: PlanAssignment,
  assignments: PlanAssignment[],
  ctx: CandidateContext,
): AssignmentCandidate[] {
  const student = ctx.students.get(assignment.studentId)!;
  const session = {
    studentId: assignment.studentId,
    date: ctx.sessions.find((x) => x.id === assignment.sessionId)?.date ?? "",
    startTime: assignment.startTime,
    endTime: assignment.endTime,
  };

  const bookedWith = new Map<number, string>();
  const planned = new Map(
    assignments.filter((x) => x.id !== assignment.id).map((x) => [x.sessionId, x.toTherapistId]),
  );
  for (const session of ctx.sessions) {
    if (session.slot !== assignment.slot || session.id === assignment.sessionId || session.status !== "scheduled") continue;
    const therapistId = planned.has(session.id) ? planned.get(session.id)! : session.therapistId;
    if (therapistId !== null) bookedWith.set(therapistId, session.studentName);
  }

  return ctx.therapists
    .map((therapist): AssignmentCandidate => {
      const classification = classify(therapist, student);
      const rules = matchingRules(ctx.preferences, therapist.id, session);
      const absence = ctx.absences.find(
        (x) => x.therapistId === therapist.id && (x.slot === null || x.slot === assignment.slot),
      );
      const unavailableReason = isAbsent(ctx.absences, therapist.id, assignment.slot)
        ? absence?.type === "off"
          ? "Rostered off"
          : `Away (${absence?.type})`
        : ctx.exclusions?.get(assignment.sessionId)?.has(therapist.id)
          ? "Parent declined"
          : bookedWith.has(therapist.id)
            ? `Booked with ${bookedWith.get(therapist.id)}`
            : rules.hard.length
              ? `${ruleLabel(rules.hard[0])}: ${rules.hard[0].summary}`
              : null;
      return {
        therapistId: therapist.id,
        therapistName: therapist.name,
        rank: therapist.rank,
        step: classification.step,
        distanceKm: classification.distanceKm,
        reasons: classification.reasons,
        available: unavailableReason === null,
        rejected: assignment.rejectedTherapistIds.includes(therapist.id),
        avoided: rules.soft.length > 0,
        preferenceNotes: [...rules.hard, ...rules.soft].map((r) => `${ruleLabel(r)}: ${r.summary}`),
        unavailableReason,
      };
    })
    .sort(
      (x, y) =>
        Number(y.available) - Number(x.available) ||
        Number(x.avoided) - Number(y.avoided) || // soft preferences come before the usual ranking
        STEP_RANK[x.step] - STEP_RANK[y.step] ||
        (x.distanceKm ?? Infinity) - (y.distanceKm ?? Infinity) ||
        x.therapistName.localeCompare(y.therapistName),
    );
}
