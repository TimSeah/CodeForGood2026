import { handle, ok } from "@/lib/http";
import { proposeForDate } from "@/lib/services/reallocation";
import { proposeBody } from "@/lib/validation/schemas";

// POST /api/reallocations/propose  { date, actor? }
// Runs the matching engine for the date and replaces any still-pending proposals.
export const POST = handle(async (req: Request) => {
  const { date, actor } = proposeBody.parse(await req.json());
  return ok(proposeForDate(date, actor), 201);
});
