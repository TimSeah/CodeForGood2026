import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/client";
import type { Session } from "@/api/types";

/** Appointments safe to present as confirmed across the centre. */
export const useConfirmedSessions = (month: string) =>
  useQuery({
    queryKey: ["confirmed-sessions", month],
    queryFn: () => api.get<Session[]>(`/sessions?month=${month}&confirmed=true`),
  });
