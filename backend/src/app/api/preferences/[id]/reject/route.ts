import { handle, ok } from "@/lib/http";
import { rejectPreference } from "@/lib/services/preferences";
import { idParam, rejectPreferenceBody } from "@/lib/validation/schemas";

// POST /api/preferences/:id/reject  { reason? } — "not a rule"; the same pattern won't be suggested again
export const POST = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const id = idParam.parse((await ctx.params).id);
  const { reason, actor } = rejectPreferenceBody.parse(await req.json().catch(() => ({})));
  return ok(rejectPreference(id, reason, actor));
});
