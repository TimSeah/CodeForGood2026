import { handle, ok, queryOf } from "@/lib/http";
import { expireOverdueAcceptances } from "@/lib/services/acceptance";
import { listPlans } from "@/lib/services/plans";
import { dateQuery } from "@/lib/validation/schemas";

// GET /api/plans?date=2031-07-11 — all plans for the date (newest first), drafts include validation issues.
// Also cancels any change whose parent missed the 15-minute deadline.
export const GET = handle((req: Request) => {
  const { date } = dateQuery.parse(queryOf(req));
  expireOverdueAcceptances();
  return ok(listPlans(date));
});
