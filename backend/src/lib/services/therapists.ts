import { getDb } from "@/lib/db/client";
import { HttpError } from "@/lib/http";
import { logAudit } from "@/lib/repositories/audit";
import { setTherapistPhone } from "@/lib/repositories/therapists";

export function updateTherapistPhone(id: number, phone: string | null, actor: string): void {
  getDb().transaction(() => {
    if (!setTherapistPhone(id, phone)) throw new HttpError(404, "Therapist not found");
    logAudit({ actor, action: "therapist.phone_updated", entityType: "therapist", entityId: id });
  })();
}
