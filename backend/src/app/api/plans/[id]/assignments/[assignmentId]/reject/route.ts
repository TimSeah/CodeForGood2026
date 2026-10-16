import { handle, ok } from "@/lib/http";
import { rejectAssignment } from "@/lib/services/plans";
import { actorBody, idParam } from "@/lib/validation/schemas";

// POST /api/plans/:id/assignments/:assignmentId/reject
// Rejects this row's therapist and re-runs just this row with the therapists still free. Returns the whole plan.
export const POST = handle(
  async (req: Request, ctx: { params: Promise<{ id: string; assignmentId: string }> }) => {
    const p = await ctx.params;
    const { actor } = actorBody.parse(await req.json().catch(() => ({})));
    return ok(rejectAssignment(idParam.parse(p.id), idParam.parse(p.assignmentId), actor));
  },
);
