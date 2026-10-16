import { parentDeadline } from "@/lib/dates";
import { getDb } from "@/lib/db/client";
import { HttpError } from "@/lib/http";
import { logAudit } from "@/lib/repositories/audit";
import {
  addExclusion,
  getAssignment,
  getPlan,
  listPendingParentAssignments,
  setParentStatus,
} from "@/lib/repositories/plans";
import { cancelSession, setSessionTherapist } from "@/lib/repositories/sessions";
import { getStudent } from "@/lib/repositories/students";
import { getInboundResponse, saveInboundResponse } from "@/lib/repositories/whatsapp-responses";
import type { ParentResponse, Plan, PlanAssignment } from "@/lib/types";
import { generatePlanForDate } from "./plans";
import { getWhatsAppGateway, therapistPhone } from "./whatsapp/gateway";
import { CENTRE_PHONE, parentCallCentreMessage, sessionWhen, therapistConfirmedMessage, therapistStandDownMessage } from "./whatsapp/messages";

// Parent acceptance after a plan is approved. Therapists are informed only; they cannot decline.

function loadPending(assignmentId: number) {
  const a = getAssignment(assignmentId);
  if (!a) throw new HttpError(404, `Assignment ${assignmentId} not found`);
  const plan = getPlan(a.planId)!;
  if (plan.status !== "approved") throw new HttpError(409, "The plan for this change hasn't been approved");
  if (a.parentStatus !== "pending") throw new HttpError(409, `Parent response already recorded (${a.parentStatus})`);
  return { a, plan };
}

/**
 * Records a parent's answer (from the WhatsApp bot, or ticked by the admin in manual mode).
 * Declined → parent is asked to call the centre, the substitute stands down, the session goes back to
 * "needs cover" with that therapist excluded, and a new draft plan is generated for the admin.
 */
export function recordParentResponse(
  assignmentId: number,
  response: ParentResponse,
  actor: string,
  inboundId?: string,
): { assignment: PlanAssignment; replan: Plan | null } {
  const { a, plan } = loadPending(assignmentId);
  const whatsapp = plan.notifyMode === "whatsapp";
  const gateway = getWhatsAppGateway();
  const student = getStudent(a.studentId)!;

  let replan: Plan | null = null;
  getDb().transaction(() => {
    setParentStatus(a.id, response);
    if (inboundId) saveInboundResponse(inboundId, a.id, response);
    logAudit({ actor, action: `parent.${response}`, entityType: "plan_assignment", entityId: a.id, details: { planId: plan.id } });
    if (response === "accepted") {
      if (whatsapp) {
        gateway.send({
          recipientType: "therapist",
          recipientId: a.toTherapistId,
          toPhone: therapistPhone(a.toTherapistId),
          purpose: "therapist_confirmed",
          body: therapistConfirmedMessage(a, plan.date),
          planAssignmentId: a.id,
          variables: [a.studentName, sessionWhen(a, plan.date)],
        });
      }
      return;
    }
    addExclusion(a.sessionId, a.toTherapistId!);
    setSessionTherapist(a.sessionId, null); // back to "needs cover"
    if (whatsapp) {
      gateway.send({
        recipientType: "guardian",
        recipientId: student.id,
        toPhone: student.guardianPhone,
        purpose: "parent_call_centre",
        body: parentCallCentreMessage(student),
        planAssignmentId: a.id,
        variables: [student.name, CENTRE_PHONE],
      });
      gateway.send({
        recipientType: "therapist",
        recipientId: a.toTherapistId,
        toPhone: therapistPhone(a.toTherapistId),
        purpose: "therapist_stand_down",
        body: therapistStandDownMessage(a, plan.date, "the family has asked for a different arrangement"),
        planAssignmentId: a.id,
        variables: [a.studentName, sessionWhen(a, plan.date), "The family has asked for a different arrangement"],
      });
    }
    replan = generatePlanForDate(plan.date, "engine");
  })();

  return { assignment: getAssignment(a.id)!, replan };
}

/** The bot may only know the sender's phone: find the latest change awaiting that guardian's answer. */
export function findPendingAssignmentByPhone(phone: string): number | null {
  const rows = getDb()
    .prepare(
      `SELECT pa.id FROM plan_assignments pa
       JOIN plans p ON p.id = pa.plan_id JOIN sessions se ON se.id = pa.session_id JOIN students s ON s.id = se.student_id
       WHERE p.status = 'approved' AND p.notify_mode = 'whatsapp' AND pa.parent_status = 'pending'
       AND REPLACE(REPLACE(REPLACE(s.guardian_phone, '+', ''), '-', ''), ' ', '') = ?
       ORDER BY se.date, se.start_time LIMIT 2`,
    )
    .all(phone.replace(/\D/g, "")) as { id: number }[];
  if (rows.length > 1) throw new HttpError(409, "Multiple sessions need a reply; include the reference number (YES 123 or NO 123)");
  return rows[0]?.id ?? null;
}

export function recordedInboundResponse(messageId: string) {
  return getInboundResponse(messageId);
}

/**
 * Cancels sessions whose parent hasn't answered by start − 15 min, and tells the substitute not to go.
 * Called lazily whenever plans are read, and via POST /api/plans/expire (pass `now` to demo it).
 */
export function expireOverdueAcceptances(now: Date = new Date()): number[] {
  const overdue = listPendingParentAssignments().filter((p) => now >= parentDeadline(p.date, p.startTime));
  for (const { id } of overdue) {
    const a = getAssignment(id)!;
    const plan = getPlan(a.planId)!;
    getDb().transaction(() => {
      setParentStatus(id, "expired");
      cancelSession(a.sessionId, "Parent did not confirm 15 minutes before the start");
      logAudit({ actor: "system", action: "parent.expired", entityType: "plan_assignment", entityId: id });
      if (plan.notifyMode === "whatsapp") {
        getWhatsAppGateway().send({
          recipientType: "therapist",
          recipientId: a.toTherapistId,
          toPhone: therapistPhone(a.toTherapistId),
          purpose: "therapist_stand_down",
          body: therapistStandDownMessage(a, plan.date, "the parent didn't confirm in time, so the session is cancelled"),
          planAssignmentId: id,
          variables: [a.studentName, sessionWhen(a, plan.date), "The family did not confirm in time"],
        });
      }
    })();
  }
  return overdue.map((o) => o.id);
}
