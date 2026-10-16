import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import { invalidateDayData } from "@/api/invalidate";
import type { Absence, AbsenceType, Slot } from "@/api/types";

export const useAbsences = (date: string) =>
  useQuery({ queryKey: ["absences", date], queryFn: () => api.get<Absence[]>(`/absences?date=${date}`) });

export interface NewAbsence {
  therapistId: number;
  date: string;
  slot: Slot | null;
  type: AbsenceType;
  note?: string;
}

/** Admin-entered absence (e.g. a phone call). The backend re-plans the date. */
export function useReportAbsence() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: NewAbsence) => api.post<Absence>("/absences", body),
    onSuccess: () => invalidateDayData(qc),
  });
}
