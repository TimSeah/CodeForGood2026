import { getDb } from "@/lib/db/client";
import { HttpError } from "@/lib/http";
import { logAudit } from "@/lib/repositories/audit";
import { setGuardianPhone } from "@/lib/repositories/students";

export function updateGuardianPhone(id: number, phone: string | null, actor: string): void {
  getDb().transaction(() => {
    if (!setGuardianPhone(id, phone)) throw new HttpError(404, "Student not found");
    logAudit({ actor, action: "student.guardian_phone_updated", entityType: "student", entityId: id });
  })();
}
