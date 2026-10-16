import { handle, ok } from "@/lib/http";
import { generatePlanForDate } from "@/lib/services/plans";
import { generatePlanBody } from "@/lib/validation/schemas";

// POST /api/plans/generate  { date } — re-run the engine; supersedes older drafts. data = null if nothing needs cover.
export const POST = handle(async (req: Request) => {
  const { date, actor } = generatePlanBody.parse(await req.json());
  return ok(generatePlanForDate(date, actor), 201);
});
