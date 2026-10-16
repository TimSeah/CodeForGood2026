import { getDb } from "@/lib/db/client";
import { HttpError } from "@/lib/http";
import { createAbsence, listAbsencesByDate } from "@/lib/repositories/absences";
import { logAudit } from "@/lib/repositories/audit";
import { getTherapist } from "@/lib/repositories/therapists";
import type { Absence } from "@/lib/types";
import type { CreateAbsenceBody } from "@/lib/validation/schemas";

export function reportAbsence({ actor, ...input }: CreateAbsenceBody): Absence {
  if (!getTherapist(input.therapistId)) throw new HttpError(404, `Therapist ${input.therapistId} not found`);

  const id = getDb().transaction(() => {
    const id = createAbsence({ ...input, note: input.note ?? null });
    logAudit({ actor, action: "absence.created", entityType: "absence", entityId: id, details: input });
    return id;
  })();

  return listAbsencesByDate(input.date).find((a) => a.id === id)!;
}
