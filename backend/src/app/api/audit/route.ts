import { handle, ok, queryOf } from "@/lib/http";
import { listAudit } from "@/lib/repositories/audit";
import { auditQuery } from "@/lib/validation/schemas";

// GET /api/audit?limit=100  (newest first)
export const GET = handle((req: Request) => {
  const { limit } = auditQuery.parse(queryOf(req));
  return ok(listAudit(limit));
});
