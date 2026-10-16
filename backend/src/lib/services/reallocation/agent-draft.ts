import type { Plan, PlanAssignment, ValidationIssue } from "@/lib/types";
import { candidatesForAssignment, type CandidateContext } from "./candidates";
import { validatePlan } from "./validate";

export interface AgentDraftSummary {
  planId: number;
  date: string;
  assignments: Array<{
    assignmentId: number;
    student: string;
    slot: PlanAssignment["slot"];
    usualTherapist: string | null;
    replacementTherapist: string | null;
    replacementTherapistId: number | null;
    rationale: string[];
  }>;
  issues: ValidationIssue[];
}

/** In-memory draft used by the agent. Nothing is persisted until finish_plan passes validation. */
export class AgentDraft {
  private readonly assignments: PlanAssignment[];

  constructor(
    private readonly plan: Plan,
    private readonly ctx: CandidateContext,
  ) {
    this.assignments = plan.assignments.map((assignment) => ({
      ...assignment,
      rationale: [...assignment.rationale],
    }));
  }

  summary(): AgentDraftSummary {
    return {
      planId: this.plan.id,
      date: this.plan.date,
      assignments: this.assignments.map((assignment) => ({
        assignmentId: assignment.id,
        student: assignment.studentName,
        slot: assignment.slot,
        usualTherapist: assignment.fromTherapistName,
        replacementTherapist: assignment.toTherapistName,
        replacementTherapistId: assignment.toTherapistId,
        rationale: assignment.rationale,
      })),
      issues: this.validate(),
    };
  }

  candidates(assignmentId: number) {
    const assignment = this.assignmentOrThrow(assignmentId);
    return candidatesForAssignment(assignment, this.assignments, this.ctx);
  }

  setAssignment(assignmentId: number, therapistId: number | null, reason: string) {
    const assignment = this.assignmentOrThrow(assignmentId);
    const rationalePrefix = `AI agent: ${reason.trim()}`;

    if (therapistId === null) {
      Object.assign(assignment, {
        toTherapistId: null,
        toTherapistName: null,
        step: "cancel" as const,
        distanceKm: null,
        rationale: [rationalePrefix],
        chainId: null,
      });
      return { assignmentId, student: assignment.studentName, replacementTherapist: null };
    }

    const candidate = this.candidates(assignmentId).find((item) => item.therapistId === therapistId);
    if (!candidate) throw new Error(`Therapist ${therapistId} does not exist`);
    if (!candidate.available) throw new Error(`${candidate.therapistName} is unavailable: ${candidate.unavailableReason}`);

    Object.assign(assignment, {
      toTherapistId: candidate.therapistId,
      toTherapistName: candidate.therapistName,
      step: candidate.step,
      distanceKm: candidate.distanceKm,
      rationale: [rationalePrefix, ...candidate.reasons],
      chainId: null,
    });
    return {
      assignmentId,
      student: assignment.studentName,
      replacementTherapist: candidate.therapistName,
    };
  }

  validate(): ValidationIssue[] {
    const issues = validatePlan({ ...this.ctx, assignments: this.assignments });
    for (const assignment of this.assignments.filter((item) => item.toTherapistId === null)) {
      const available = candidatesForAssignment(assignment, this.assignments, this.ctx).filter((item) => item.available);
      if (available.length > 0) {
        issues.push({
          level: "error",
          assignmentId: assignment.id,
          message: `${assignment.studentName}'s ${assignment.slot} cancellation is avoidable; available: ${available
            .slice(0, 3)
            .map((item) => item.therapistName)
            .join(", ")}`,
        });
      }
    }
    return issues;
  }

  finish() {
    const issues = this.validate();
    return {
      valid: !issues.some((issue) => issue.level === "error"),
      issues,
      assignments: this.assignments.map((assignment) => ({ ...assignment, rationale: [...assignment.rationale] })),
    };
  }

  private assignmentOrThrow(assignmentId: number) {
    const assignment = this.assignments.find((item) => item.id === assignmentId);
    if (!assignment) throw new Error(`Assignment ${assignmentId} is not part of plan ${this.plan.id}`);
    return assignment;
  }
}
