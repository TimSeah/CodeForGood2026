import { handle, ok, queryOf } from "@/lib/http";
import { listBotReports } from "@/lib/repositories/bot-reports";
import { simulateReport } from "@/lib/services/intake";
import { dateQuery, simulateReportBody } from "@/lib/validation/schemas";

// GET /api/intake/reports?date=2031-07-11 — WhatsApp reports covering that date, plus any still unmatched
export const GET = handle((req: Request) => {
  const { date } = dateQuery.parse(queryOf(req));
  return ok(listBotReports(date));
});

// POST /api/intake/reports — add a report without the bot (demo, or a phone call), then ingest it
export const POST = handle(async (req: Request) => {
  const { actor, ...body } = simulateReportBody.parse(await req.json());
  return ok(simulateReport(body, actor), 201);
});
