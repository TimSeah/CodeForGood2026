import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import type { Absence, AbsenceType, Slot } from "@/api/types";

export const absencesKey = (date: string) => ["absences", date] as const;

export const useAbsences = (date: string) =>
  useQuery({ queryKey: absencesKey(date), queryFn: () => api.get<Absence[]>(`/absences?date=${date}`) });

export interface NewAbsence {
  therapistId: number;
  date: string;
  slot: Slot | null;
  type: AbsenceType;
  note?: string;
}

export function useReportAbsence() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: NewAbsence) => api.post<Absence>("/absences", body),
    onSuccess: (a) => qc.invalidateQueries({ queryKey: absencesKey(a.date) }),
  });
}
