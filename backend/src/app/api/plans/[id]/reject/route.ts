import { handle, ok } from "@/lib/http";
import { rejectPlan } from "@/lib/services/plans";
import { actorBody, idParam } from "@/lib/validation/schemas";

// POST /api/plans/:id/reject
export const POST = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const id = idParam.parse((await ctx.params).id);
  const { actor } = actorBody.parse(await req.json().catch(() => ({})));
  return ok(rejectPlan(id, actor));
});
