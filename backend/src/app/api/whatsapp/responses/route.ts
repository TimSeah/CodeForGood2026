import { HttpError, handle, ok } from "@/lib/http";
import { getAssignment, getPlan } from "@/lib/repositories/plans";
import { getStudent } from "@/lib/repositories/students";
import { findPendingAssignmentByPhone, recordedInboundResponse, recordParentResponse } from "@/lib/services/acceptance";
import { requireBot } from "@/lib/services/whatsapp/auth";
import { whatsappResponseBody } from "@/lib/validation/schemas";

export const POST = handle(async (req: Request) => {
  requireBot(req);
  const body = whatsappResponseBody.parse(await req.json());
  const prior = recordedInboundResponse(body.messageId);
  if (prior) return ok({ assignmentId: prior.assignmentId, response: prior.response, duplicate: true });
  const assignmentId = body.assignmentId ?? findPendingAssignmentByPhone(body.phone);
  if (assignmentId === null) throw new HttpError(404, "No change is awaiting a reply from this number");
  const assignment = getAssignment(assignmentId);
  const student = assignment && getStudent(assignment.studentId);
  if (!student?.guardianPhone || getPlan(assignment!.planId)?.notifyMode !== "whatsapp" ||
      student.guardianPhone.replace(/\D/g, "") !== body.phone.replace(/\D/g, "")) {
    throw new HttpError(404, "No change is awaiting a reply from this number");
  }
  const response = body.response === "yes" || body.response === "accepted" ? "accepted" : "declined";
  const result = recordParentResponse(assignmentId, response, "whatsapp", body.messageId);
  return ok({ assignmentId: result.assignment.id, response, duplicate: false });
});
