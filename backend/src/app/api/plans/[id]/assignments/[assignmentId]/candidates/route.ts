import { handle, ok } from "@/lib/http";
import { listCandidates } from "@/lib/services/plans";
import { idParam } from "@/lib/validation/schemas";

// GET /api/plans/:id/assignments/:assignmentId/candidates — every therapist, ranked, with availability
export const GET = handle(
  async (_req: Request, ctx: { params: Promise<{ id: string; assignmentId: string }> }) => {
    const p = await ctx.params;
    return ok(listCandidates(idParam.parse(p.id), idParam.parse(p.assignmentId)));
  },
);
