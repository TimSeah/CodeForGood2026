import { deadlineTime } from "@/lib/dates";
import { getDb } from "@/lib/db/client";
import { HttpError } from "@/lib/http";
import { logAudit } from "@/lib/repositories/audit";
import {
  createAssignment,
  createPlan,
  getPlan,
  listPlansByDate,
  setPlanStatus,
  supersedeDrafts,
  updateAssignmentTarget,
} from "@/lib/repositories/plans";
import { getPreviousSessionLog } from "@/lib/repositories/session-logs";
import { cancelSession, reassignSession } from "@/lib/repositories/sessions";
import { getStudent } from "@/lib/repositories/students";
import type { AssignmentCandidate, NotifyMode, Plan, PlanAssignment } from "@/lib/types";
import { isAbsent } from "./reallocation/availability";
import { loadDayContext } from "./reallocation/context";
import { type ProposedAssignment, proposeReallocations } from "./reallocation/engine";
import { classify, STEP_RANK } from "./reallocation/ranking";
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
  const { primary, swapAlternative } = proposeReallocations(ctx);

  const previousEdits = listPlansByDate(date)
    .filter((p) => p.status === "draft" && p.kind !== "swap_alternative")
    .flatMap((p) => p.assignments.filter((a) => a.editedByAdmin));
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
  for (const edit of previousEdits) {
    const target = fresh.assignments.find((a) => a.sessionId === edit.sessionId);
    if (target && target.toTherapistId !== edit.toTherapistId) applyEdit(fresh, target, edit.toTherapistId, ctx);
  }
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

/** Admin changes who covers one session in a draft. The result is validated, not rejected outright. */
export function editAssignment(planId: number, assignmentId: number, toTherapistId: number | null, actor: string): Plan {
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
      details: { planId, from: a.toTherapistId, to: toTherapistId },
    });
  })();
  return getPlanOrThrow(planId);
}

/** Every therapist as an option for one assignment, best first, with why they can't take it if so. */
export function listCandidates(planId: number, assignmentId: number): AssignmentCandidate[] {
  const plan = getPlanOrThrow(planId);
  const a = plan.assignments.find((x) => x.id === assignmentId);
  if (!a) throw new HttpError(404, `Assignment ${assignmentId} is not part of plan ${planId}`);
  const ctx = loadDayContext(plan.date);
  const student = ctx.students.get(a.studentId)!;

  // Who is booked in this slot once the OTHER changes in this plan are applied.
  const bookedWith = new Map<number, string>();
  const planned = new Map(plan.assignments.filter((x) => x.id !== a.id).map((x) => [x.sessionId, x.toTherapistId]));
  for (const s of ctx.sessions) {
    if (s.slot !== a.slot || s.id === a.sessionId || s.status !== "scheduled") continue;
    const tid = planned.has(s.id) ? planned.get(s.id)! : s.therapistId;
    if (tid !== null) bookedWith.set(tid, s.studentName);
  }

  return ctx.therapists
    .map((t): AssignmentCandidate => {
      const c = classify(t, student);
      const absence = ctx.absences.find((x) => x.therapistId === t.id && (x.slot === null || x.slot === a.slot));
      const unavailableReason = isAbsent(ctx.absences, t.id, a.slot)
        ? absence?.type === "off"
          ? "Rostered off"
          : `Away (${absence?.type})`
        : ctx.exclusions.get(a.sessionId)?.has(t.id)
          ? "Parent declined"
          : bookedWith.has(t.id)
            ? `Booked with ${bookedWith.get(t.id)}`
            : null;
      return {
        therapistId: t.id,
        therapistName: t.name,
        rank: t.rank,
        step: c.step,
        distanceKm: c.distanceKm,
        reasons: c.reasons,
        available: unavailableReason === null,
        unavailableReason,
      };
    })
    .sort(
      (x, y) =>
        Number(y.available) - Number(x.available) ||
        STEP_RANK[x.step] - STEP_RANK[y.step] ||
        (x.distanceKm ?? Infinity) - (y.distanceKm ?? Infinity) ||
        x.therapistName.localeCompare(y.therapistName),
    );
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
