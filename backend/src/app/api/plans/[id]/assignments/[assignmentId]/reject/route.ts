import { handle, ok } from "@/lib/http";
import { rejectAssignment } from "@/lib/services/plans";
import { idParam, rejectAssignmentBody } from "@/lib/validation/schemas";

// POST /api/plans/:id/assignments/:assignmentId/reject  { reason?: { code, note? } }
// Rejects this row's therapist and re-runs just this row with the therapists still free. Returns the whole plan.
export const POST = handle(
  async (req: Request, ctx: { params: Promise<{ id: string; assignmentId: string }> }) => {
    const p = await ctx.params;
    const { reason, actor } = rejectAssignmentBody.parse(await req.json().catch(() => ({})));
    return ok(rejectAssignment(idParam.parse(p.id), idParam.parse(p.assignmentId), actor, reason));
  },
);
