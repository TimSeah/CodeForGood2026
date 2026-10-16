import { handle, ok } from "@/lib/http";
import { decideReallocation } from "@/lib/services/reallocation";
import { decideReallocationBody, idParam } from "@/lib/validation/schemas";

// PATCH /api/reallocations/:id  { status: "approved" | "rejected", actor? }
export const PATCH = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const id = idParam.parse((await ctx.params).id);
  const { status, actor } = decideReallocationBody.parse(await req.json());
  return ok(decideReallocation(id, status, actor));
});
