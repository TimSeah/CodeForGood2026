import { handle, ok } from "@/lib/http";
import { pausePreference } from "@/lib/services/preferences";
import { actorBody, idParam } from "@/lib/validation/schemas";

// POST /api/preferences/:id/pause — stop applying an active rule without deleting it
export const POST = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const id = idParam.parse((await ctx.params).id);
  const { actor } = actorBody.parse(await req.json().catch(() => ({})));
  return ok(pausePreference(id, actor));
});
