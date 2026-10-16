import { handle, ok } from "@/lib/http";
import { updateGuardianPhone } from "@/lib/services/students";
import { guardianPhoneBody, idParam } from "@/lib/validation/schemas";

export const PATCH = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const id = idParam.parse((await ctx.params).id);
  const { phone, actor } = guardianPhoneBody.parse(await req.json());
  updateGuardianPhone(id, phone, actor);
  return ok({ updated: true });
});
