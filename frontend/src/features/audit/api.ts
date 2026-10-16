import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/client";
import type { AuditEntry } from "@/api/types";

export const useAuditLog = (limit = 100) =>
  useQuery({ queryKey: ["audit", limit], queryFn: () => api.get<AuditEntry[]>(`/audit?limit=${limit}`) });
