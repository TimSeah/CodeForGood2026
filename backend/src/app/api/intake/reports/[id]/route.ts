import { handle, ok } from "@/lib/http";
import { ignoreReport, ingestReport } from "@/lib/services/intake";
import { idParam, resolveReportBody } from "@/lib/validation/schemas";

// PATCH /api/intake/reports/:id  { therapistId } | { studentId } | { ignore: true }
// Resolves an unmatched report: match it to the roster (then it's ingested and re-planned) or ignore it.
export const PATCH = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const id = idParam.parse((await ctx.params).id);
  const body = resolveReportBody.parse(await req.json());
  if ("ignore" in body) return ok(ignoreReport(id, body.actor));
  return ok(ingestReport(id, body.actor, "therapistId" in body ? { therapistId: body.therapistId } : { studentId: body.studentId }));
});
