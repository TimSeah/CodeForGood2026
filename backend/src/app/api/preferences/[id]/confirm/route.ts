import { handle, ok } from "@/lib/http";
import { confirmPreference } from "@/lib/services/preferences";
import { confirmPreferenceBody, idParam } from "@/lib/validation/schemas";

// POST /api/preferences/:id/confirm  { strength, days?, boundaryTime?, appliesTo?, ongoing?, effectiveFrom?, effectiveTo?, reason? }
// Suggestion → active rule. Time rules must state days, exact time, start/end, and ongoing or an end date.
export const POST = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const id = idParam.parse((await ctx.params).id);
  const { actor, ...body } = confirmPreferenceBody.parse(await req.json());
  return ok(confirmPreference(id, body, actor));
});
