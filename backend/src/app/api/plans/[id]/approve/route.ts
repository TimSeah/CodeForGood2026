import { handle, ok } from "@/lib/http";
import { approvePlan } from "@/lib/services/plans";
import { approvePlanBody, idParam } from "@/lib/validation/schemas";

export const runtime = "nodejs";
export const maxDuration = 900;

// POST /api/plans/:id/approve  { notifyMode: "whatsapp" | "manual" }
// 409 with the validation errors in `details` if the plan isn't valid.
export const POST = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const id = idParam.parse((await ctx.params).id);
  const { notifyMode, actor } = approvePlanBody.parse(await req.json());
  return ok(await approvePlan(id, notifyMode, actor));
});
