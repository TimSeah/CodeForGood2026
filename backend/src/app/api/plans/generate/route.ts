import { handle, ok } from "@/lib/http";
import { generateAgentPlanForDate } from "@/lib/services/rescheduling-agent";
import { generatePlanForDate } from "@/lib/services/plans";
import { generatePlanBody } from "@/lib/validation/schemas";

// POST /api/plans/generate  { date, mode: "rules" | "agent", prompt? } — data = null if nothing needs cover.
export const POST = handle(async (req: Request) => {
  const { date, mode, prompt, actor } = generatePlanBody.parse(await req.json());
  const plan = mode === "agent"
    ? await generateAgentPlanForDate(date, prompt!, actor)
    : generatePlanForDate(date, actor);
  return ok(plan, 201);
});
