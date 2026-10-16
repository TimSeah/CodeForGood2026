import { handle, ok } from "@/lib/http";
import { listSessionVideoReviews, prepareSessionVideoUpload } from "@/lib/services/video-reviews";
import { createVideoReviewBody } from "@/lib/validation/schemas";

export const runtime = "nodejs";

// GET /api/video-reviews — newest first, with local media endpoints.
export const GET = handle(() => ok(listSessionVideoReviews()));

// POST /api/video-reviews { fileName, contentType, sizeBytes } — create a draft and local upload URL.
export const POST = handle(async (req: Request) => {
  const { actor, ...body } = createVideoReviewBody.parse(await req.json());
  return ok(prepareSessionVideoUpload(body, actor), 201);
});
