import { handle, ok } from "@/lib/http";
import { resumePreference } from "@/lib/services/preferences";
import { actorBody, idParam } from "@/lib/validation/schemas";

// POST /api/preferences/:id/resume — re-activate a paused rule
export const POST = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const id = idParam.parse((await ctx.params).id);
  const { actor } = actorBody.parse(await req.json().catch(() => ({})));
  return ok(resumePreference(id, actor));
});
