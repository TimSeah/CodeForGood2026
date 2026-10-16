import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import type { Reallocation } from "@/api/types";
import { sessionsKey } from "@/features/schedule/api";

export const reallocationsKey = (date: string) => ["reallocations", date] as const;

export const useReallocations = (date: string) =>
  useQuery({
    queryKey: reallocationsKey(date),
    queryFn: () => api.get<Reallocation[]>(`/reallocations?date=${date}`),
  });

/** Runs the matching engine for the date (replaces any still-pending proposals). */
export function useProposeReallocations(date: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<Reallocation[]>("/reallocations/propose", { date }),
    onSuccess: (data) => qc.setQueryData(reallocationsKey(date), data),
  });
}

export function useDecideReallocation(date: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: number; status: "approved" | "rejected" }) =>
      api.patch<Reallocation>(`/reallocations/${id}`, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: reallocationsKey(date) });
      qc.invalidateQueries({ queryKey: sessionsKey(date) });
    },
  });
}
