import { handle, ok } from "@/lib/http";
import { recordParentResponse } from "@/lib/services/acceptance";
import { idParam, parentResponseBody } from "@/lib/validation/schemas";

// POST /api/assignments/:id/parent-response  { response: "accepted" | "declined" }
// Admin records the parent's answer (manual mode, or a phone call). Declined → returns the new draft as `replan`.
export const POST = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const id = idParam.parse((await ctx.params).id);
  const { response, actor } = parentResponseBody.parse(await req.json());
  return ok(recordParentResponse(id, response, actor));
});
