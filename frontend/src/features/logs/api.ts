import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import type { Attendance, SessionLog, Slot } from "@/api/types";

export interface LogFilter {
  date?: string;
  studentId?: number;
  therapistId?: number;
}

const qs = (f: LogFilter) =>
  new URLSearchParams(Object.entries(f).filter(([, v]) => v !== undefined && v !== "") as [string, string][]).toString();

export const useSessionLogs = (filter: LogFilter) =>
  useQuery({ queryKey: ["session-logs", filter], queryFn: () => api.get<SessionLog[]>(`/session-logs?${qs(filter)}`) });

export interface SessionLogInput {
  sessionId: number | null;
  date: string;
  slot: Slot;
  studentId: number;
  therapistId: number;
  attendance: Attendance;
  summary: string | null;
  notes: string | null;
  goals: string | null;
}

function useLogMutation<TVars>(fn: (vars: TVars) => Promise<unknown>) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: fn, onSuccess: () => qc.invalidateQueries({ queryKey: ["session-logs"] }) });
}

export const useCreateLog = () => useLogMutation((body: SessionLogInput) => api.post<SessionLog>("/session-logs", body));
export const useUpdateLog = () =>
  useLogMutation(({ id, ...body }: Partial<SessionLogInput> & { id: number }) => api.patch<SessionLog>(`/session-logs/${id}`, body));
export const useDeleteLog = () => useLogMutation((id: number) => api.delete<{ id: number }>(`/session-logs/${id}`));

/** The single-session PDF (what a substitute therapist receives). */
export const logPdfUrl = (id: number) => `/api/session-logs/${id}/pdf`;
