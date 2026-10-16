import { handle, ok } from "@/lib/http";
import { saveSessionVideoUpload } from "@/lib/services/video-reviews";
import { actorBody, idParam } from "@/lib/validation/schemas";

type Ctx = { params: Promise<{ id: string }> };

export const runtime = "nodejs";
export const maxDuration = 900;

// PUT /api/session-logs/:id/video/upload — stream the recording directly to local storage.
export const PUT = handle(async (req: Request, ctx: Ctx) => {
  const sessionLogId = idParam.parse((await ctx.params).id);
  const { actor } = actorBody.parse({ actor: req.headers.get("x-actor") ?? undefined });
  return ok(await saveSessionVideoUpload(sessionLogId, req.body, actor));
});
