import { HttpError, handle } from "@/lib/http";
import { getNotification } from "@/lib/repositories/notifications";
import { getSessionLogOrThrow, renderSessionLogPdf } from "@/lib/services/session-logs";
import { requireBot } from "@/lib/services/whatsapp/auth";
import { idParam } from "@/lib/validation/schemas";

export const GET = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  requireBot(req);
  const notification = getNotification(idParam.parse((await ctx.params).id));
  const match = notification?.purpose === "therapist_cover" && notification.toPhone &&
    /^\/api\/session-logs\/(\d+)\/pdf$/.exec(notification.attachment ?? "");
  if (!match) throw new HttpError(404, "Attachment not found");
  const log = getSessionLogOrThrow(Number(match[1]));
  const bytes = await renderSessionLogPdf(log, true);
  return new Response(Buffer.from(bytes), { headers: { "Content-Type": "application/pdf", "Cache-Control": "no-store" } });
});
