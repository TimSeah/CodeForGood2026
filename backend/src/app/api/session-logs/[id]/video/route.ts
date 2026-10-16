import { handle, ok } from "@/lib/http";
import { prepareSessionVideoUpload } from "@/lib/services/video-reviews";
import { createVideoReviewBody, idParam } from "@/lib/validation/schemas";

type Ctx = { params: Promise<{ id: string }> };

export const runtime = "nodejs";

// POST /api/session-logs/:id/video — prepare a private upload attached to this log.
export const POST = handle(async (req: Request, ctx: Ctx) => {
  const sessionLogId = idParam.parse((await ctx.params).id);
  const { actor, ...body } = createVideoReviewBody.parse(await req.json());
  return ok(prepareSessionVideoUpload(sessionLogId, body, actor), 201);
});
