import { handle, ok, queryOf } from "@/lib/http";
import { listSessionsByDate } from "@/lib/repositories/sessions";
import { dateQuery } from "@/lib/validation/schemas";

// GET /api/sessions?date=2031-07-11
export const GET = handle((req: Request) => {
  const { date } = dateQuery.parse(queryOf(req));
  return ok(listSessionsByDate(date));
});
