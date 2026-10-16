import { deadlineTime } from "@/lib/dates";
import { getDb } from "@/lib/db/client";
import { HttpError } from "@/lib/http";
import { logAudit } from "@/lib/repositories/audit";
import {
  type AssignmentSnapshot,
  createAssignment,
  createPlan,
  getAssignmentHistory,
  getPlan,
  listPlansByDate,
  setAssignmentState,
  setPlanStatus,
  setRejectedTherapists,
  supersedeDrafts,
  updateAssignmentTarget,
} from "@/lib/repositories/plans";
import { getPreviousSessionLog } from "@/lib/repositories/session-logs";
import { cancelSession, reassignSession } from "@/lib/repositories/sessions";
import { getStudent } from "@/lib/repositories/students";
import type { AssignmentCandidate, ChangeReason, NotifyMode, Plan, PlanAssignment } from "@/lib/types";
import { recordAssignmentChange } from "./preferences";
import { candidatesForAssignment } from "./reallocation/candidates";
import { loadDayContext } from "./reallocation/context";
import { type ProposedAssignment, proposeReallocations } from "./reallocation/engine";
import { classify } from "./reallocation/ranking";
import { validatePlan } from "./reallocation/validate";
import { getWhatsAppGateway } from "./whatsapp/gateway";
import {
  parentCancelledMessage,
  parentConfirmMessage,
  therapistCoverMessage,
} from "./whatsapp/messages";

/** Adds validation issues to drafts (approved/rejected plans are history, so they're not re-validated). */
function withIssues(plan: Omit<Plan, "issues">, ctx = loadDayContext(plan.date)): Plan {
  if (plan.status !== "draft") return { ...plan, issues: [] };
  const issues = validatePlan({ ...ctx, assignments: plan.assignments });
  return { ...plan, issues };
}

export function listPlans(date: string): Plan[] {
  const ctx = loadDayContext(date);
  return listPlansByDate(date).map((p) => withIssues(p, ctx));
}

export function getPlanOrThrow(id: number): Plan {
  const plan = getPlan(id);
  if (!plan) throw new HttpError(404, `Plan ${id} not found`);
  return withIssues(plan);
}

function insertAssignments(planId: number, proposals: ProposedAssignment[]) {
  for (const p of proposals) createAssignment({ planId, ...p });
}

/**
 * Runs the engine for a date and stores the result as a new draft plan (plus a swap alternative, if any).
 * Older drafts for the date are superseded; admin edits on the previous primary draft are carried over.
 * Returns null when no session needs cover.
 */
export function generatePlanForDate(date: string, actor: string): Plan | null {
  const ctx = loadDayContext(date);
  const previousRows = listPlansByDate(date)
    .filter((p) => p.status === "draft" && p.kind !== "swap_alternative")
    .flatMap((p) => p.assignments);
  const previousEdits = previousRows.filter((a) => a.editedByAdmin);

  // Therapists the admin rejected for a row stay rejected in the new draft (treated like exclusions).
  const rejections = new Map<number, number[]>();
  for (const a of previousRows) {
    if (a.rejectedTherapistIds.length) rejections.set(a.sessionId, a.rejectedTherapistIds);
  }
  const exclusions = new Map([...ctx.exclusions].map(([k, v]) => [k, new Set(v)]));
  for (const [sessionId, ids] of rejections) {
    exclusions.set(sessionId, new Set([...(exclusions.get(sessionId) ?? []), ...ids]));
  }
  const { primary, swapAlternative } = proposeReallocations({ ...ctx, exclusions });
  const hasApproved = listPlansByDate(date).some((p) => p.status === "approved");

  const planId = getDb().transaction(() => {
    supersedeDrafts(date);
    if (primary.length === 0) return null;

    const id = createPlan({ date, kind: hasApproved ? "replan" : "primary", parentPlanId: null, createdBy: actor });
    insertAssignments(id, primary);
    if (swapAlternative) {
      const altId = createPlan({ date, kind: "swap_alternative", parentPlanId: id, createdBy: actor });
      insertAssignments(altId, swapAlternative);
    }
    logAudit({
      actor,
      action: "plan.generated",
      entityType: "plan",
      entityId: id,
      details: { date, changes: primary.length, swapAlternative: !!swapAlternative },
    });
    return id;
  })();
  if (planId === null) return null;

  // Re-apply the admin's manual choices from the superseded draft (validation will flag any that no longer work).
  const fresh = getPlan(planId)!;
  for (const a of fresh.assignments) {
    const ids = rejections.get(a.sessionId);
    if (ids) setRejectedTherapists(a.id, ids);
  }
  for (const edit of previousEdits) {
    const target = fresh.assignments.find((a) => a.sessionId === edit.sessionId);
    if (target && target.toTherapistId !== edit.toTherapistId) applyEdit(fresh, target, edit.toTherapistId, ctx);
  }
  return getPlanOrThrow(planId);
}

/** Persists an agent's in-memory draft only after the shared validator confirms it has no hard conflicts. */
export function applyAgentDraft(
  planId: number,
  assignments: PlanAssignment[],
  prompt: string,
  requestedBy: string,
): Plan {
  const plan = getPlanOrThrow(planId);
  if (plan.status !== "draft") throw new HttpError(409, "Only draft plans can be edited");
  if (
    assignments.length !== plan.assignments.length ||
    assignments.some((assignment) => !plan.assignments.some((current) => current.id === assignment.id && current.sessionId === assignment.sessionId))
  ) {
    throw new HttpError(400, "The AI agent returned assignments that do not belong to this plan");
  }

  const ctx = loadDayContext(plan.date);
  const issues = validatePlan({ ...ctx, assignments });
  const errors = issues.filter((issue) => issue.level === "error");
  if (errors.length) throw new HttpError(409, "The AI agent produced an invalid schedule", errors);

  const changes = assignments.filter((assignment) => {
    const current = plan.assignments.find((item) => item.id === assignment.id)!;
    return current.toTherapistId !== assignment.toTherapistId || current.rationale.join("\n") !== assignment.rationale.join("\n");
  });
  getDb().transaction(() => {
    for (const assignment of changes) {
      updateAssignmentTarget(
        assignment.id,
        {
          toTherapistId: assignment.toTherapistId,
          step: assignment.step,
          distanceKm: assignment.distanceKm,
          rationale: assignment.rationale,
        },
        false,
      );
    }
    logAudit({
      actor: "ai-agent",
      action: "plan.agent_refined",
      entityType: "plan",
      entityId: planId,
      details: {
        requestedBy,
        prompt,
        changes: changes.map((assignment) => ({
          assignmentId: assignment.id,
          studentId: assignment.studentId,
          toTherapistId: assignment.toTherapistId,
        })),
      },
    });
  })();
  return getPlanOrThrow(planId);
}

function applyEdit(plan: Omit<Plan, "issues">, a: PlanAssignment, toTherapistId: number | null, ctx = loadDayContext(plan.date)) {
  if (toTherapistId === null) {
    updateAssignmentTarget(a.id, { toTherapistId: null, step: "cancel", distanceKm: null, rationale: ["Cancelled by admin"] });
    return;
  }
  const t = ctx.therapists.find((x) => x.id === toTherapistId);
  if (!t) throw new HttpError(400, `Therapist ${toTherapistId} does not exist`);
  const c = classify(t, ctx.students.get(a.studentId)!);
  updateAssignmentTarget(a.id, {
    toTherapistId,
    step: "manual",
    distanceKm: c.distanceKm,
    rationale: [`Chosen by admin (would rank as: ${c.step})`, ...c.reasons],
  });
}

/**
 * Admin changes who covers one session in a draft. The result is validated, not rejected outright.
 * The admin's reason (if given) is recorded as evidence for the scheduling preference memory.
 */
export function editAssignment(
  planId: number,
  assignmentId: number,
  toTherapistId: number | null,
  actor: string,
  reason?: ChangeReason | null,
): Plan {
  const plan = getPlanOrThrow(planId);
  if (plan.status !== "draft") throw new HttpError(409, "Only draft plans can be edited");
  const a = plan.assignments.find((x) => x.id === assignmentId);
  if (!a) throw new HttpError(404, `Assignment ${assignmentId} is not part of plan ${planId}`);

  getDb().transaction(() => {
    applyEdit(plan, a, toTherapistId);
    logAudit({
      actor,
      action: "plan.assignment_edited",
      entityType: "plan_assignment",
      entityId: assignmentId,
      details: { planId, from: a.toTherapistId, to: toTherapistId, reason: reason ?? null },
    });
    recordAssignmentChange({ planId, date: plan.date, assignment: a, newTherapistId: toTherapistId, action: "edited", reason, actor });
  })();
  return getPlanOrThrow(planId);
}

/**
 * Admin rejects one row's proposal: that therapist is never proposed for this row again (in this draft and
 * any regenerated draft), and the row is re-run alone using the therapists still free in that slot, keeping every
 * other row as it is. If nobody is left, the row becomes a cancellation. The previous state is kept for Undo.
 */
export function rejectAssignment(
  planId: number,
  assignmentId: number,
  actor: string,
  reason?: ChangeReason | null,
): Plan {
  const plan = getPlanOrThrow(planId);
  if (plan.status !== "draft") throw new HttpError(409, "Only draft plans can be changed");
  const a = plan.assignments.find((x) => x.id === assignmentId);
  if (!a) throw new HttpError(404, `Assignment ${assignmentId} is not part of plan ${planId}`);
  if (a.chainId) throw new HttpError(409, "This row is part of a swap — reject the whole swap plan instead");

  const rejectedName = a.toTherapistName;
  const rejected =
    a.toTherapistId === null || a.rejectedTherapistIds.includes(a.toTherapistId)
      ? a.rejectedTherapistIds
      : [...a.rejectedTherapistIds, a.toTherapistId];
  // Same ordering as the engine: available first, then rule step, then distance.
  const next = listCandidates(planId, assignmentId).find((c) => c.available && !rejected.includes(c.therapistId));
  const rejectedNote = rejectedName ? `Re-run after you rejected ${rejectedName}` : "Re-run on request";

  getDb().transaction(() => {
    setAssignmentState(a.id, {
      toTherapistId: next?.therapistId ?? null,
      step: next?.step ?? "cancel",
      distanceKm: next?.distanceKm ?? null,
      rationale: next
        ? [rejectedNote, ...next.reasons]
        : [`${rejectedNote}: no other therapist is free in the ${a.slot} slot`],
      editedByAdmin: false,
      rejectedTherapistIds: rejected,
      history: [...getAssignmentHistory(a.id), snapshot(a)],
    });
    logAudit({
      actor,
      action: "plan.assignment_rejected",
      entityType: "plan_assignment",
      entityId: a.id,
      details: { planId, rejected: a.toTherapistId, next: next?.therapistId ?? null, reason: reason ?? null },
    });
    recordAssignmentChange({
      planId,
      date: plan.date,
      assignment: a,
      newTherapistId: next?.therapistId ?? null,
      action: "rejected",
      reason,
      actor,
    });
  })();
  return getPlanOrThrow(planId);
}

/** Undo the latest row-level reject: restores the previous therapist and un-rejects them. */
export function undoAssignmentReject(planId: number, assignmentId: number, actor: string): Plan {
  const plan = getPlanOrThrow(planId);
  if (plan.status !== "draft") throw new HttpError(409, "Only draft plans can be changed");
  const a = plan.assignments.find((x) => x.id === assignmentId);
  if (!a) throw new HttpError(404, `Assignment ${assignmentId} is not part of plan ${planId}`);
  const history = getAssignmentHistory(a.id);
  const previous = history.pop();
  if (!previous) throw new HttpError(409, "Nothing to undo for this row");

  getDb().transaction(() => {
    setAssignmentState(a.id, { ...previous, history });
    logAudit({
      actor,
      action: "plan.assignment_reject_undone",
      entityType: "plan_assignment",
      entityId: a.id,
      details: { planId, restored: previous.toTherapistId },
    });
  })();
  return getPlanOrThrow(planId);
}

const snapshot = (a: PlanAssignment): AssignmentSnapshot => ({
  toTherapistId: a.toTherapistId,
  step: a.step,
  distanceKm: a.distanceKm,
  rationale: a.rationale,
  editedByAdmin: a.editedByAdmin,
  rejectedTherapistIds: a.rejectedTherapistIds,
});

/** Every therapist as an option for one assignment, best first, with why they can't take it if so. */
export function listCandidates(planId: number, assignmentId: number): AssignmentCandidate[] {
  const plan = getPlanOrThrow(planId);
  const a = plan.assignments.find((x) => x.id === assignmentId);
  if (!a) throw new HttpError(404, `Assignment ${assignmentId} is not part of plan ${planId}`);
  return candidatesForAssignment(a, plan.assignments, loadDayContext(plan.date));
}

/**
 * Applies a draft to the live schedule. With notifyMode "whatsapp", parents are asked to confirm and the
 * substitute gets the child's last-session summary + PDF. With "manual", nothing is sent and the admin records
 * parent responses in the portal.
 */
export function approvePlan(planId: number, notifyMode: NotifyMode, actor: string): Plan {
  const plan = getPlanOrThrow(planId);
  if (plan.status !== "draft") throw new HttpError(409, `Plan ${planId} is already ${plan.status}`);
  const errors = plan.issues.filter((i) => i.level === "error");
  if (errors.length) throw new HttpError(409, "Fix the plan's errors before approving", errors);

  getDb().transaction(() => {
    for (const a of plan.assignments) {
      if (a.toTherapistId === null) cancelSession(a.sessionId, a.rationale.join("; "));
      else reassignSession(a.sessionId, a.toTherapistId);
    }
    setPlanStatus(planId, "approved", actor, notifyMode);
    supersedeDrafts(plan.date); // the other drafts (e.g. the swap alternative) were alternatives to this one
    logAudit({ actor, action: "plan.approved", entityType: "plan", entityId: planId, details: { notifyMode } });
    if (notifyMode === "whatsapp") sendApprovalMessages(plan);
  })();
  return getPlanOrThrow(planId);
}

function sendApprovalMessages(plan: Plan) {
  const gateway = getWhatsAppGateway();
  for (const a of plan.assignments) {
    const student = getStudent(a.studentId)!;
    const guardian = { recipientType: "guardian" as const, recipientId: student.id, toPhone: student.guardianPhone, planAssignmentId: a.id };
    if (a.toTherapistId === null) {
      gateway.send({ ...guardian, purpose: "parent_cancelled", body: parentCancelledMessage(a, plan.date, student) });
      continue;
    }
    gateway.send({
      ...guardian,
      purpose: "parent_confirm",
      body: parentConfirmMessage(a, plan.date, student, deadlineTime(a.startTime)),
    });
    const previous = getPreviousSessionLog(a.studentId, plan.date, a.slot);
    gateway.send({
      recipientType: "therapist",
      recipientId: a.toTherapistId,
      toPhone: null, // TODO: therapist phone numbers aren't in the seed data yet
      purpose: "therapist_cover",
      body: therapistCoverMessage(a, plan.date, previous),
      attachment: previous ? `/api/session-logs/${previous.id}/pdf` : null,
      planAssignmentId: a.id,
    });
  }
}

export function rejectPlan(planId: number, actor: string): Plan {
  const plan = getPlanOrThrow(planId);
  if (plan.status !== "draft") throw new HttpError(409, `Plan ${planId} is already ${plan.status}`);
  getDb().transaction(() => {
    setPlanStatus(planId, "rejected", actor);
    logAudit({ actor, action: "plan.rejected", entityType: "plan", entityId: planId });
  })();
  return getPlanOrThrow(planId);
}
