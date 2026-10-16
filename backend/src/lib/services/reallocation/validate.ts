import type { Absence, Session, Slot, Therapist, ValidationIssue } from "@/lib/types";
import { isAbsent } from "./availability";
import { matchingRules, type PreferenceRule, ruleLabel } from "./preferences";
import { ENGINE_CONFIG, type EngineConfig, type EngineStudent, fitsTier } from "./ranking";

// PURE check of a tentative plan against the day's schedule. Errors block approval; warnings are shown only.

export interface AssignmentToCheck {
  id: number;
  sessionId: number;
  toTherapistId: number | null;
}

export function validatePlan(args: {
  assignments: AssignmentToCheck[];
  sessions: Session[]; // the date's sessions as they are now
  absences: Absence[];
  therapists: Therapist[];
  students: Map<number, EngineStudent>;
  exclusions?: Map<number, Set<number>>;
  /** Confirmed preferences: active hard → error, active soft → warning. Suggestions are ignored. */
  preferences?: PreferenceRule[];
  config?: Partial<EngineConfig>;
}): ValidationIssue[] {
  const config = { ...ENGINE_CONFIG, ...args.config };
  const byId = new Map(args.therapists.map((t) => [t.id, t]));
  const sessionById = new Map(args.sessions.map((s) => [s.id, s]));
  const issues: ValidationIssue[] = [];

  // Resulting therapist per session after the plan is applied.
  const resulting = new Map(args.sessions.map((s) => [s.id, s.status === "scheduled" ? s.therapistId : null]));
  for (const a of args.assignments) resulting.set(a.sessionId, a.toTherapistId);

  for (const a of args.assignments) {
    const session = sessionById.get(a.sessionId);
    if (!session) {
      issues.push({ level: "error", message: `Session ${a.sessionId} not found on this date`, assignmentId: a.id });
      continue;
    }
    if (a.toTherapistId === null) {
      issues.push({ level: "warning", message: `${session.studentName}'s ${session.slot} session will be cancelled`, assignmentId: a.id });
      continue;
    }
    const t = byId.get(a.toTherapistId);
    if (!t) {
      issues.push({ level: "error", message: `Therapist ${a.toTherapistId} does not exist`, assignmentId: a.id });
      continue;
    }
    const child = args.students.get(session.studentId)!;
    const who = `${t.name} → ${session.studentName} (${session.slot})`;

    if (isAbsent(args.absences, t.id, session.slot)) {
      issues.push({ level: "error", message: `${who}: ${t.name} is away or rostered off`, assignmentId: a.id });
    }
    if (args.exclusions?.get(session.id)?.has(t.id)) {
      issues.push({ level: "error", message: `${who}: the parent already declined ${t.name}`, assignmentId: a.id });
    }
    if (config.designatedOnlyForHomeSchool && session.location !== "clinic") {
      issues.push({ level: "error", message: `${who}: ${session.location} sessions need the designated therapist`, assignmentId: a.id });
    }
    const rules = matchingRules(args.preferences, t.id, session);
    for (const r of rules.hard) {
      issues.push({ level: "error", message: `${who}: breaks confirmed ${ruleLabel(r)} — ${r.summary}`, assignmentId: a.id });
    }
    for (const r of rules.soft) {
      issues.push({
        level: "warning",
        message: `${who}: goes against confirmed ${ruleLabel(r)} — ${r.summary}. Keep it only if no suitable alternative is free.`,
        assignmentId: a.id,
      });
    }
    if (child.blacklist.has(t.id)) {
      issues.push({ level: "warning", message: `${who}: on the child's blacklist`, assignmentId: a.id });
    }
    if (!fitsTier(t, child.plan)) {
      issues.push({ level: "warning", message: `${who}: ${t.rank} is outside the ${child.plan} plan`, assignmentId: a.id });
    }
    if (!child.team.has(t.id)) {
      issues.push({ level: "warning", message: `${who}: not on the child's team`, assignmentId: a.id });
    }
  }

  // Double-booking in the resulting schedule.
  const load = new Map<string, string[]>();
  for (const s of args.sessions) {
    const tid = resulting.get(s.id);
    if (tid == null) continue;
    const key = `${tid}:${s.slot}`;
    load.set(key, [...(load.get(key) ?? []), s.studentName]);
  }
  for (const [key, children] of load) {
    if (children.length < 2) continue;
    const [tid, slot] = key.split(":") as [string, Slot];
    const name = byId.get(Number(tid))?.name ?? tid;
    const culprit = args.assignments.find(
      (a) => a.toTherapistId === Number(tid) && sessionById.get(a.sessionId)?.slot === slot,
    );
    // Only flag clashes this plan creates (the seed data has a few alternating "Brock/Luke" style rows).
    if (!culprit) continue;
    issues.push({
      level: "error",
      message: `${name} would be double-booked in the ${slot} slot (${children.join(", ")})`,
      assignmentId: culprit?.id,
    });
  }
  return issues;
}
