import { HttpError, handle, ok } from "@/lib/http";
import { findPendingAssignmentByPhone, recordParentResponse } from "@/lib/services/acceptance";
import { whatsappResponseBody } from "@/lib/validation/schemas";

// POST /api/whatsapp/responses  { assignmentId? , phone?, response: "yes" | "no" | "accepted" | "declined" }
// For the WhatsApp bot to call when a parent replies to a confirmation message.
// TODO(bot-integration): the bot doesn't call this yet. Add a shared secret header before exposing it.
export const POST = handle(async (req: Request) => {
  const body = whatsappResponseBody.parse(await req.json());
  const assignmentId = body.assignmentId ?? findPendingAssignmentByPhone(body.phone!);
  if (assignmentId === null) throw new HttpError(404, "No change is awaiting a reply from this number");
  const response = body.response === "yes" || body.response === "accepted" ? "accepted" : "declined";
  return ok(recordParentResponse(assignmentId, response, "whatsapp"));
});
