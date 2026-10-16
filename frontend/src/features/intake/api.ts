import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import { invalidateDayData } from "@/api/invalidate";
import type { BotDayPart, BotReport, BotRole } from "@/api/types";

export const useBotReports = (date: string) =>
  useQuery({
    queryKey: ["bot-reports", date],
    queryFn: () => api.get<BotReport[]>(`/intake/reports?date=${date}`),
    refetchInterval: 30_000,
  });

interface SyncResult {
  available: boolean;
  path: string;
  imported: number;
}

/**
 * Pulls new reports from the WhatsApp bot every 30 s (the backend ingests them and re-plans automatically).
 * Modelled as a polling query so it starts/stops with the page.
 */
export function useBotSync() {
  const qc = useQueryClient();
  return useQuery({
    queryKey: ["bot-sync"],
    queryFn: async () => {
      const result = await api.post<SyncResult>("/intake/sync", {});
      if (result.imported > 0) invalidateDayData(qc);
      return { ...result, syncedAt: new Date() };
    },
    refetchInterval: 30_000,
  });
}

export interface NewReport {
  role: BotRole;
  name: string;
  startDate: string;
  endDate: string;
  dayPart: BotDayPart;
  mcAttached: boolean;
}

/** A report entered by the admin (or to demo the bot without WhatsApp). */
export function useAddReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: NewReport) => api.post<BotReport>("/intake/reports", body),
    onSuccess: () => invalidateDayData(qc),
  });
}

export type ReportResolution = { therapistId: number } | { studentId: number } | { ignore: true };

export function useResolveReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: number } & ReportResolution) => api.patch<BotReport>(`/intake/reports/${id}`, body),
    onSuccess: () => invalidateDayData(qc),
  });
}
