import { handle, ok } from "@/lib/http";
import { processSessionLogVideo } from "@/lib/services/video-reviews";
import { idParam, processVideoReviewBody } from "@/lib/validation/schemas";

type Ctx = { params: Promise<{ id: string }> };

export const runtime = "nodejs";
export const maxDuration = 900;

// POST /api/session-logs/:id/video/process — generate the gist and titled clips when requested.
export const POST = handle(async (req: Request, ctx: Ctx) => {
  const sessionLogId = idParam.parse((await ctx.params).id);
  const { actor } = processVideoReviewBody.parse(await req.json());
  return ok(await processSessionLogVideo(sessionLogId, actor));
});
