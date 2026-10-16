import { handle, ok, queryOf } from "@/lib/http";
import { createPreference, listPreferences } from "@/lib/services/preferences";
import { createPreferenceBody, preferenceQuery } from "@/lib/validation/schemas";

// GET /api/preferences?status=suggested,active — scheduling preferences (suggestions + rules) with evidence
export const GET = handle((req: Request) => {
  const { status } = preferenceQuery.parse(queryOf(req));
  return ok(listPreferences(status));
});

// POST /api/preferences  { type, therapistId, studentId?, strength, days?, boundaryTime?, appliesTo?, ongoing?, effectiveFrom?, effectiveTo?, reason? }
// Admin adds a rule directly; it is active immediately (the admin is the confirmer).
export const POST = handle(async (req: Request) => {
  const { actor, ...body } = createPreferenceBody.parse(await req.json());
  return ok(createPreference(body, actor), 201);
});
