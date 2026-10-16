import { handle, ok } from "@/lib/http";
import { editPreference, getPreferenceOrThrow, removePreference } from "@/lib/services/preferences";
import { actorBody, editPreferenceBody, idParam } from "@/lib/validation/schemas";

type Ctx = { params: Promise<{ id: string }> };

// GET /api/preferences/:id
export const GET = handle(async (_req: Request, ctx: Ctx) => ok(getPreferenceOrThrow(idParam.parse((await ctx.params).id))));

// PATCH /api/preferences/:id  { strength, days?, boundaryTime?, appliesTo?, ongoing?, effectiveFrom?, effectiveTo?, reason? }
// Edit an active or paused rule. Unsent fields keep their value.
export const PATCH = handle(async (req: Request, ctx: Ctx) => {
  const id = idParam.parse((await ctx.params).id);
  const { actor, ...body } = editPreferenceBody.parse(await req.json());
  return ok(editPreference(id, body, actor));
});

// DELETE /api/preferences/:id — remove a rule (kept as status "removed" for the audit trail)
export const DELETE = handle(async (req: Request, ctx: Ctx) => {
  const id = idParam.parse((await ctx.params).id);
  const { actor } = actorBody.parse(await req.json().catch(() => ({})));
  return ok(removePreference(id, actor));
});
