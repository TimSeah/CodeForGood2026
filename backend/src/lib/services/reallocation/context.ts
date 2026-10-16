import { listAbsencesByDate } from "@/lib/repositories/absences";
import { listExclusions } from "@/lib/repositories/plans";
import { listSessionsByDate } from "@/lib/repositories/sessions";
import { listCoverHistory, listStudents } from "@/lib/repositories/students";
import { listTherapists } from "@/lib/repositories/therapists";
import type { EngineStudent } from "./ranking";

/** Loads everything the pure engine / validator needs for one date. */
export function loadDayContext(date: string) {
  const history = listCoverHistory(date);
  const students = new Map<number, EngineStudent>(
    listStudents().map((s) => [
      s.id,
      {
        id: s.id,
        name: s.name,
        plan: s.plan,
        homeArea: s.homeArea,
        team: new Set(s.teamTherapistIds),
        blacklist: new Set(s.blacklistTherapistIds),
        history: history.get(s.id) ?? new Set(),
      },
    ]),
  );
  return {
    sessions: listSessionsByDate(date),
    absences: listAbsencesByDate(date),
    therapists: listTherapists(),
    students,
    exclusions: listExclusions(date),
  };
}
