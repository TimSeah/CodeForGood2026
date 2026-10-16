import { caseWeekday, formatTime12, WEEKDAY_NAMES } from "@/lib/dates";
import type { SchedulingPreference } from "@/lib/types";

// PURE: does a confirmed scheduling preference apply to (therapist, session)? Shared by the engine, candidate
// lists, validation and the AI agent tools, so they can never disagree. Only status "active" ever applies —
// suggestions, paused, rejected and removed preferences are ignored here by design.

/** The parts of a preference the scheduler needs (a full SchedulingPreference also fits). */
export type PreferenceRule = Pick<
  SchedulingPreference,
  | "id"
  | "type"
  | "therapistId"
  | "studentId"
  | "strength"
  | "status"
  | "days"
  | "boundaryTime"
  | "appliesTo"
  | "effectiveFrom"
  | "effectiveTo"
  | "summary"
>;

/** What the matcher needs to know about a session. */
export interface SessionTimes {
  studentId: number;
  date: string;
  startTime: string;
  endTime: string;
}

/** Does this rule cover this therapist in this session? (Ignores status — see activeRules.) */
export function preferenceApplies(rule: PreferenceRule, therapistId: number, session: SessionTimes): boolean {
  if (rule.therapistId !== therapistId) return false;
  if (rule.effectiveFrom && session.date < rule.effectiveFrom) return false;
  if (rule.effectiveTo && session.date > rule.effectiveTo) return false;
  if (rule.type === "pairing") return rule.studentId === session.studentId;

  // time_unavailable: needs explicit days AND an explicit boundary on start or end. Incomplete → never applies.
  if (!rule.days?.length || !rule.boundaryTime || !rule.appliesTo) return false;
  if (!rule.days.includes(caseWeekday(session.date))) return false;
  return rule.appliesTo === "start"
    ? session.startTime >= rule.boundaryTime // starts at or after the boundary
    : session.endTime > rule.boundaryTime; // still running after the boundary
}

export const activeRules = <T extends PreferenceRule>(rules: readonly T[] | undefined): T[] =>
  (rules ?? []).filter((r) => r.status === "active");

/** Active rules that apply, split by strength. */
export function matchingRules<T extends PreferenceRule>(
  rules: readonly T[] | undefined,
  therapistId: number,
  session: SessionTimes,
): { hard: T[]; soft: T[] } {
  const hits = activeRules(rules).filter((r) => preferenceApplies(r, therapistId, session));
  return { hard: hits.filter((r) => r.strength === "hard"), soft: hits.filter((r) => r.strength === "soft") };
}

export const ruleLabel = (r: Pick<PreferenceRule, "id" | "strength">) => `Rule #${r.id} (${r.strength === "hard" ? "never" : "avoid"})`;

const listDays = (days: number[]) => {
  const sorted = [...days].sort();
  if (sorted.join() === "1,2,3,4,5") return "weekdays";
  if (sorted.join() === "1,3,5") return "Mon, Wed, Fri";
  if (sorted.join() === "2,4") return "Tue, Thu";
  return sorted.map((d) => WEEKDAY_NAMES[d]).join(", ");
};

/** Plain-language statement of a preference, used everywhere it is shown (UI, rationale, validation). */
export function summarizePreference(p: {
  type: SchedulingPreference["type"];
  strength: SchedulingPreference["strength"];
  therapistName: string;
  studentName: string | null;
  days: number[] | null;
  boundaryTime: string | null;
  appliesTo: SchedulingPreference["appliesTo"];
  effectiveFrom: string | null;
  effectiveTo: string | null;
}): string {
  const dates =
    p.effectiveFrom && p.effectiveTo
      ? ` (${p.effectiveFrom} to ${p.effectiveTo})`
      : p.effectiveTo
        ? ` (until ${p.effectiveTo})`
        : p.effectiveFrom
          ? ` (from ${p.effectiveFrom})`
          : "";
  if (p.type === "pairing") {
    const child = p.studentName ?? "this child";
    return p.strength === "hard"
      ? `Never assign ${p.therapistName} to ${child}${dates}`
      : `Avoid ${p.therapistName} for ${child} when another suitable therapist is free${dates}`;
  }
  if (!p.boundaryTime || !p.appliesTo || !p.days?.length) {
    return `${p.therapistName}: time unavailability not set yet — needs the exact time, days and start/end`;
  }
  const when =
    p.appliesTo === "start"
      ? `sessions starting at or after ${formatTime12(p.boundaryTime)}`
      : `sessions running past ${formatTime12(p.boundaryTime)}`;
  const verb = p.strength === "hard" ? `${p.therapistName} can't take` : `Avoid giving ${p.therapistName}`;
  return `${verb} ${when} on ${listDays(p.days)}${dates}`;
}
