import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import type { PreferenceStatus, PreferenceType, SchedulingPreference, TimeBoundaryAppliesTo } from "@/api/types";

export const usePreferences = (statuses?: PreferenceStatus[]) =>
  useQuery({
    queryKey: ["preferences", statuses?.join(",") ?? "all"],
    queryFn: () => api.get<SchedulingPreference[]>(`/preferences${statuses ? `?status=${statuses.join(",")}` : ""}`),
    refetchInterval: 30_000,
  });

/** Fields the admin sets when confirming, creating or editing a rule. */
export interface PreferenceInput {
  strength: "soft" | "hard";
  days?: number[] | null;
  boundaryTime?: string | null;
  appliesTo?: TimeBoundaryAppliesTo | null;
  ongoing?: boolean;
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
  reason?: string | null;
}

// A preference change can alter validation of today's drafts, so refetch plans + candidates too.
function usePrefMutation<TVars>(fn: (vars: TVars) => Promise<unknown>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      for (const key of ["preferences", "plans", "candidates", "audit"]) qc.invalidateQueries({ queryKey: [key] });
    },
  });
}

export const useConfirmPreference = () =>
  usePrefMutation(({ id, ...body }: PreferenceInput & { id: number }) => api.post<SchedulingPreference>(`/preferences/${id}/confirm`, body));

export const useRejectPreference = () =>
  usePrefMutation(({ id, reason }: { id: number; reason?: string }) => api.post<SchedulingPreference>(`/preferences/${id}/reject`, { reason }));

export const useEditPreference = () =>
  usePrefMutation(({ id, ...body }: PreferenceInput & { id: number }) => api.patch<SchedulingPreference>(`/preferences/${id}`, body));

export const usePausePreference = () =>
  usePrefMutation((id: number) => api.post<SchedulingPreference>(`/preferences/${id}/pause`, {}));

export const useResumePreference = () =>
  usePrefMutation((id: number) => api.post<SchedulingPreference>(`/preferences/${id}/resume`, {}));

export const useRemovePreference = () =>
  usePrefMutation((id: number) => api.delete<SchedulingPreference>(`/preferences/${id}`));

export const useCreatePreference = () =>
  usePrefMutation((body: PreferenceInput & { type: PreferenceType; therapistId: number; studentId?: number | null }) =>
    api.post<SchedulingPreference>("/preferences", body),
  );
