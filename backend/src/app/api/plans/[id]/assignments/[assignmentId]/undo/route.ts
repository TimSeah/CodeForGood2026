import { handle, ok } from "@/lib/http";
import { undoAssignmentReject } from "@/lib/services/plans";
import { actorBody, idParam } from "@/lib/validation/schemas";

// POST /api/plans/:id/assignments/:assignmentId/undo — undo the latest row reject. Returns the whole plan.
export const POST = handle(
  async (req: Request, ctx: { params: Promise<{ id: string; assignmentId: string }> }) => {
    const p = await ctx.params;
    const { actor } = actorBody.parse(await req.json().catch(() => ({})));
    return ok(undoAssignmentReject(idParam.parse(p.id), idParam.parse(p.assignmentId), actor));
  },
);
