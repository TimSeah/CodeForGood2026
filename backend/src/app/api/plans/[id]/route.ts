import { handle, ok } from "@/lib/http";
import { getPlanOrThrow } from "@/lib/services/plans";
import { idParam } from "@/lib/validation/schemas";

// GET /api/plans/:id
export const GET = handle(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  return ok(getPlanOrThrow(idParam.parse((await ctx.params).id)));
});
