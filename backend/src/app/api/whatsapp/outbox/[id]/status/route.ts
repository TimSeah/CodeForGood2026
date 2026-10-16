import { HttpError, handle, ok } from "@/lib/http";
import { requireBot } from "@/lib/services/whatsapp/auth";
import { recordNotificationDelivery } from "@/lib/services/whatsapp/delivery";
import { idParam, whatsappDeliveryBody } from "@/lib/validation/schemas";

export const POST = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  requireBot(req);
  const id = idParam.parse((await ctx.params).id);
  const { status, messageId, error } = whatsappDeliveryBody.parse(await req.json());
  if (status !== "failed" && !messageId) throw new HttpError(400, "A Meta message ID is required");
  return ok(recordNotificationDelivery(id, status, messageId, error));
});
