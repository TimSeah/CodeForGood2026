import { handle, ok } from "@/lib/http";
import { editSessionLog, getSessionLogOrThrow, removeSessionLog } from "@/lib/services/session-logs";
import { actorBody, idParam, updateSessionLogBody } from "@/lib/validation/schemas";

type Ctx = { params: Promise<{ id: string }> };

// GET /api/session-logs/:id
export const GET = handle(async (_req: Request, ctx: Ctx) => ok(getSessionLogOrThrow(idParam.parse((await ctx.params).id))));

// PATCH /api/session-logs/:id  (any subset of the fields)
export const PATCH = handle(async (req: Request, ctx: Ctx) => {
  const id = idParam.parse((await ctx.params).id);
  const { actor, ...body } = updateSessionLogBody.parse(await req.json());
  return ok(editSessionLog(id, body, actor));
});

// DELETE /api/session-logs/:id
export const DELETE = handle(async (req: Request, ctx: Ctx) => {
  const id = idParam.parse((await ctx.params).id);
  const { actor } = actorBody.parse(await req.json().catch(() => ({})));
  removeSessionLog(id, actor);
  return ok({ id });
});
