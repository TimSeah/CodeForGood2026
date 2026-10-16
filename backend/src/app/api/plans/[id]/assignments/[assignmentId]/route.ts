import { handle, ok } from "@/lib/http";
import { editAssignment } from "@/lib/services/plans";
import { editAssignmentBody, idParam } from "@/lib/validation/schemas";

// PATCH /api/plans/:id/assignments/:assignmentId  { toTherapistId: number | null }   (null = cancel the session)
// Returns the whole plan with fresh validation issues.
export const PATCH = handle(
  async (req: Request, ctx: { params: Promise<{ id: string; assignmentId: string }> }) => {
    const p = await ctx.params;
    const { toTherapistId, actor } = editAssignmentBody.parse(await req.json());
    return ok(editAssignment(idParam.parse(p.id), idParam.parse(p.assignmentId), toTherapistId, actor));
  },
);
