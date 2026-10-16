import { handle, ok, queryOf } from "@/lib/http";
import { listMonthlyPatterns } from "@/lib/repositories/patterns";
import { monthQuery } from "@/lib/validation/schemas";

// GET /api/schedule/monthly?month=2031-07 — the recurring MWF / TT allocation per therapist (Case-Allocation.xlsx)
export const GET = handle((req: Request) => {
  const { month } = monthQuery.parse(queryOf(req));
  return ok(listMonthlyPatterns(month));
});
