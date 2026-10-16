import { handle, ok, queryOf } from "@/lib/http";
import { listAbsencesByDate } from "@/lib/repositories/absences";
import { reportAbsence } from "@/lib/services/absences";
import { createAbsenceBody, dateQuery } from "@/lib/validation/schemas";

// GET /api/absences?date=2031-07-11
export const GET = handle((req: Request) => {
  const { date } = dateQuery.parse(queryOf(req));
  return ok(listAbsencesByDate(date));
});

// POST /api/absences  { therapistId, date, slot?, type, note?, actor? }
export const POST = handle(async (req: Request) => {
  const body = createAbsenceBody.parse(await req.json());
  return ok(reportAbsence(body), 201);
});
