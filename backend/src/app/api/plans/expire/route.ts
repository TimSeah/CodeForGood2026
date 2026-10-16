import { handle, ok } from "@/lib/http";
import { expireOverdueAcceptances } from "@/lib/services/acceptance";
import { expireBody } from "@/lib/validation/schemas";

// POST /api/plans/expire  { now?: ISO datetime } — cancel changes whose parent missed the deadline.
// Pass `now` to demo the deadline with the 2031 case-study dates.
export const POST = handle(async (req: Request) => {
  const { now } = expireBody.parse(await req.json().catch(() => ({})));
  return ok({ expiredAssignmentIds: expireOverdueAcceptances(now ? new Date(now) : undefined) });
});
