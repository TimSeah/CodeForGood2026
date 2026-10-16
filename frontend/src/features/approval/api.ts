import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import { invalidateDayData } from "@/api/invalidate";
import type { AssignmentCandidate, GenerationMode, Notification, NotifyMode, Plan, PlanAssignment } from "@/api/types";

export const usePlans = (date: string) =>
  useQuery({ queryKey: ["plans", date], queryFn: () => api.get<Plan[]>(`/plans?date=${date}`), refetchInterval: 30_000 });

export const useNotifications = (date: string) =>
  useQuery({ queryKey: ["notifications", date], queryFn: () => api.get<Notification[]>(`/notifications?date=${date}`) });

export const useCandidates = (planId: number, assignmentId: number, enabled: boolean) =>
  useQuery({
    queryKey: ["candidates", planId, assignmentId],
    queryFn: () => api.get<AssignmentCandidate[]>(`/plans/${planId}/assignments/${assignmentId}/candidates`),
    enabled,
  });

function useDayMutation<TVars, TResult>(fn: (vars: TVars) => Promise<TResult>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      invalidateDayData(qc);
      qc.invalidateQueries({ queryKey: ["candidates"] });
    },
  });
}

export const useGeneratePlan = () =>
  useDayMutation(({ date, mode, prompt }: { date: string; mode: GenerationMode; prompt?: string }) =>
    api.post<Plan | null>("/plans/generate", { date, mode, prompt }),
  );

export const useEditAssignment = () =>
  useDayMutation(({ planId, assignmentId, toTherapistId }: { planId: number; assignmentId: number; toTherapistId: number | null }) =>
    api.patch<Plan>(`/plans/${planId}/assignments/${assignmentId}`, { toTherapistId }),
  );

/** Reject one row's therapist; the backend re-runs that row alone with the therapists still free. */
export const useRejectAssignment = () =>
  useDayMutation(({ planId, assignmentId }: { planId: number; assignmentId: number }) =>
    api.post<Plan>(`/plans/${planId}/assignments/${assignmentId}/reject`, {}),
  );

/** Undo the latest row reject (restores the previous therapist). */
export const useUndoAssignmentReject = () =>
  useDayMutation(({ planId, assignmentId }: { planId: number; assignmentId: number }) =>
    api.post<Plan>(`/plans/${planId}/assignments/${assignmentId}/undo`, {}),
  );

export const useApprovePlan = () =>
  useDayMutation(({ planId, notifyMode }: { planId: number; notifyMode: NotifyMode }) =>
    api.post<Plan>(`/plans/${planId}/approve`, { notifyMode }),
  );

export const useRejectPlan = () => useDayMutation((planId: number) => api.post<Plan>(`/plans/${planId}/reject`, {}));

export const useParentResponse = () =>
  useDayMutation(({ assignmentId, response }: { assignmentId: number; response: "accepted" | "declined" }) =>
    api.post<{ assignment: PlanAssignment; replan: Plan | null }>(`/assignments/${assignmentId}/parent-response`, { response }),
  );

/** Demo helper: run the 15-minute deadline check as if it were `now`. */
export const useRunDeadlineCheck = () =>
  useDayMutation((now: string) => api.post<{ expiredAssignmentIds: number[] }>("/plans/expire", { now }));
