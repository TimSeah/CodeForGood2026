import { handle, ok } from "@/lib/http";
import { saveSessionVideoUpload } from "@/lib/services/video-reviews";
import { actorBody, idParam } from "@/lib/validation/schemas";

export const runtime = "nodejs";
export const maxDuration = 900;

// PUT /api/video-reviews/:id/upload — stream a raw video request body directly to local disk.
export const PUT = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const id = idParam.parse((await ctx.params).id);
  const { actor } = actorBody.parse({ actor: req.headers.get("x-actor") ?? undefined });
  return ok(await saveSessionVideoUpload(id, req.body, actor));
});
