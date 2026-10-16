import { handle, ok, queryOf } from "@/lib/http";
import { listSessionLogs } from "@/lib/repositories/session-logs";
import { addSessionLog } from "@/lib/services/session-logs";
import { createSessionLogBody, sessionLogQuery } from "@/lib/validation/schemas";

// GET /api/session-logs?date=&from=&to=&studentId=&therapistId=   (newest first, max 200)
export const GET = handle((req: Request) => ok(listSessionLogs(sessionLogQuery.parse(queryOf(req)))));

// POST /api/session-logs  { sessionId?, date, slot, studentId, therapistId, attendance, summary?, notes?, goals? }
export const POST = handle(async (req: Request) => {
  const { actor, ...body } = createSessionLogBody.parse(await req.json());
  return ok(addSessionLog(body, actor), 201);
});
