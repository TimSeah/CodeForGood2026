import { getDb } from "@/lib/db/client";
import { HttpError } from "@/lib/http";
import { listAbsencesByDate } from "@/lib/repositories/absences";
import { logAudit } from "@/lib/repositories/audit";
import {
  createReallocation,
  deletePendingProposalsForDate,
  getReallocation,
  listReallocationsByDate,
  setReallocationStatus,
} from "@/lib/repositories/reallocations";
import { cancelSession, listSessionsByDate, reassignSession } from "@/lib/repositories/sessions";
import { listStudents } from "@/lib/repositories/students";
import { listTherapists } from "@/lib/repositories/therapists";
import type { Reallocation } from "@/lib/types";
import { proposeReallocations } from "./engine";

/** Load the day's data, run the engine, and store its proposals (replacing older pending ones). */
export function proposeForDate(date: string, actor: string): Reallocation[] {
  const teams = new Map(listStudents().map((s) => [s.id, new Set(s.teamTherapistIds)]));
  const proposals = proposeReallocations({
    sessions: listSessionsByDate(date),
    absences: listAbsencesByDate(date),
    therapists: listTherapists(),
    teams,
  });

  getDb().transaction(() => {
    deletePendingProposalsForDate(date);
    for (const p of proposals) createReallocation({ ...p, proposedBy: "engine" });
    logAudit({ actor, action: "reallocation.proposed", entityType: "date", details: { date, count: proposals.length } });
  })();

  return listReallocationsByDate(date);
}

/** Approve (apply to the schedule) or reject a single proposal. */
export function decideReallocation(id: number, status: "approved" | "rejected", actor: string): Reallocation {
  const r = getReallocation(id);
  if (!r) throw new HttpError(404, `Reallocation ${id} not found`);
  if (r.status !== "proposed") throw new HttpError(409, `Reallocation ${id} is already ${r.status}`);

  getDb().transaction(() => {
    setReallocationStatus(id, status, actor);
    if (status === "approved") {
      if (r.toTherapistId === null) cancelSession(r.sessionId, r.rationale.join("; "));
      else reassignSession(r.sessionId, r.toTherapistId);
      // TODO: enqueue notifications (therapist + guardian) in the notifications table.
    }
    logAudit({ actor, action: `reallocation.${status}`, entityType: "reallocation", entityId: id, details: r });
  })();

  return getReallocation(id)!;
}
