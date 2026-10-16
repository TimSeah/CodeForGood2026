import { handle, ok, queryOf } from "@/lib/http";
import { listNotificationsByDate } from "@/lib/repositories/notifications";
import { dateQuery } from "@/lib/validation/schemas";

// GET /api/notifications?date=2031-07-11 — WhatsApp outbox for changes on that date (placeholder until the bot sends)
export const GET = handle((req: Request) => {
  const { date } = dateQuery.parse(queryOf(req));
  return ok(listNotificationsByDate(date));
});
