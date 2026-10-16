import { handle } from "@/lib/http";
import { getSessionLogOrThrow, renderSessionLogPdf } from "@/lib/services/session-logs";
import { idParam } from "@/lib/validation/schemas";

// GET /api/session-logs/:id/pdf — the single-session PDF attached to a substitute therapist's WhatsApp message.
export const GET = handle(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const log = getSessionLogOrThrow(idParam.parse((await ctx.params).id));
  const bytes = await renderSessionLogPdf(log);
  return new Response(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="session-${log.date}-${log.slot}-${log.studentName.replace(/\W+/g, "_")}.pdf"`,
    },
  });
});
