import { handle, ok, queryOf } from "@/lib/http";
import { listSessionsByDate, listSessionsForMonth } from "@/lib/repositories/sessions";
import { sessionsQuery } from "@/lib/validation/schemas";

// GET /api/sessions?date=2031-07-11
// GET /api/sessions?month=2031-07&therapistId=3   (or &studentId=5) — one person's month, for calendars
export const GET = handle((req: Request) => {
  const q = sessionsQuery.parse(queryOf(req));
  return ok("date" in q ? listSessionsByDate(q.date) : listSessionsForMonth(q.month, q));
});
