import { handle, ok } from "@/lib/http";
import { processPreviousVideoForTakeover } from "@/lib/services/video-reviews";
import { prepareVideoHandoverBody } from "@/lib/validation/schemas";

export const runtime = "nodejs";
export const maxDuration = 900;

// POST /api/session-logs/handover-video — prepare the previous recording when a new therapist opens a child.
export const POST = handle(async (req: Request) => {
  const body = prepareVideoHandoverBody.parse(await req.json());
  return ok(await processPreviousVideoForTakeover(body.studentId, body.date, body.slot, body.actor));
});
