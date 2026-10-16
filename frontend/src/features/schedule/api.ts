import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/client";
import type { MonthlyPatternRow, Session } from "@/api/types";

export const useSessions = (date: string) =>
  useQuery({ queryKey: ["sessions", date], queryFn: () => api.get<Session[]>(`/sessions?date=${date}`) });

export const useMonthlyPattern = (month: string) =>
  useQuery({
    queryKey: ["monthly-pattern", month],
    queryFn: () => api.get<MonthlyPatternRow[]>(`/schedule/monthly?month=${month}`),
  });

export type Person = { kind: "therapist" | "student"; id: number };

/** One therapist's or child's sessions for a month (for the calendar views). */
export const usePersonMonth = (month: string, person: Person | null) =>
  useQuery({
    queryKey: ["person-month", month, person?.kind, person?.id],
    queryFn: () =>
      api.get<Session[]>(`/sessions?month=${month}&${person!.kind === "therapist" ? "therapistId" : "studentId"}=${person!.id}`),
    enabled: person !== null,
  });
