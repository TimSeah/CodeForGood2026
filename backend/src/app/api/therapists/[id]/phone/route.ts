import { handle, ok } from "@/lib/http";
import { updateTherapistPhone } from "@/lib/services/therapists";
import { idParam, therapistPhoneBody } from "@/lib/validation/schemas";

export const PATCH = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const id = idParam.parse((await ctx.params).id);
  const { phone, actor } = therapistPhoneBody.parse(await req.json());
  updateTherapistPhone(id, phone, actor);
  return ok({ updated: true });
});
