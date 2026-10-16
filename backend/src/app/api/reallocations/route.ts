import { handle, ok, queryOf } from "@/lib/http";
import { listReallocationsByDate } from "@/lib/repositories/reallocations";
import { dateQuery } from "@/lib/validation/schemas";

// GET /api/reallocations?date=2031-07-11
export const GET = handle((req: Request) => {
  const { date } = dateQuery.parse(queryOf(req));
  return ok(listReallocationsByDate(date));
});
