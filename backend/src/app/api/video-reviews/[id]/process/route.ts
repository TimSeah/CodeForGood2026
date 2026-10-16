import { handle, ok } from "@/lib/http";
import { processSessionVideo } from "@/lib/services/video-reviews";
import { idParam, processVideoReviewBody } from "@/lib/validation/schemas";

export const runtime = "nodejs";
export const maxDuration = 900;

// POST /api/video-reviews/:id/process — extract audio/frames locally, ask OpenAI for a review, and create local clips.
export const POST = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const id = idParam.parse((await ctx.params).id);
  const { actor } = processVideoReviewBody.parse(await req.json());
  return ok(await processSessionVideo(id, actor));
});
