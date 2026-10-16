import { handle, ok } from "@/lib/http";
import { pendingNotifications } from "@/lib/repositories/notifications";
import { requireBot } from "@/lib/services/whatsapp/auth";

export const GET = handle((req: Request) => {
  requireBot(req);
  return ok(pendingNotifications().map(({ id, toPhone, purpose, body, variables, attachment, planAssignmentId }) =>
    ({ id, toPhone, purpose, body, variables, attachment, planAssignmentId })));
});
