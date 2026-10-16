import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/client";
import type { Session } from "@/api/types";

export const sessionsKey = (date: string) => ["sessions", date] as const;

export const useSessions = (date: string) =>
  useQuery({ queryKey: sessionsKey(date), queryFn: () => api.get<Session[]>(`/sessions?date=${date}`) });
