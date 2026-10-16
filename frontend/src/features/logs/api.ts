import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import type { Attendance, CreateVideoReviewResult, SessionLog, Slot, VideoReview } from "@/api/types";

export interface LogFilter {
  date?: string;
  studentId?: number;
  therapistId?: number;
}

const qs = (f: LogFilter) =>
  new URLSearchParams(Object.entries(f).filter(([, v]) => v !== undefined && v !== "") as [string, string][]).toString();

export const useSessionLogs = (filter: LogFilter) =>
  useQuery({
    queryKey: ["session-logs", filter],
    queryFn: () => api.get<SessionLog[]>(`/session-logs?${qs(filter)}`),
    refetchInterval: (query) => (query.state.data?.some((log) => log.videoReview?.status === "processing") ? 3_000 : false),
  });

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

export const useCreateLog = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: SessionLogInput) => api.post<SessionLog>("/session-logs", body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["session-logs"] }),
  });
};
export const useUpdateLog = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: Partial<SessionLogInput> & { id: number }) => api.patch<SessionLog>(`/session-logs/${id}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["session-logs"] }),
  });
};
export const useDeleteLog = () => useLogMutation((id: number) => api.delete<{ id: number }>(`/session-logs/${id}`));

async function uploadVideo({ sessionLogId, file }: { sessionLogId: number; file: File }): Promise<VideoReview> {
  const extension = file.name.split(".").pop()?.toLowerCase();
  const contentType = file.type || {
    mp4: "video/mp4",
    webm: "video/webm",
    mov: "video/quicktime",
    mkv: "video/x-matroska",
  }[extension ?? ""];
  if (!contentType) throw new Error("Choose an MP4, WebM, MOV, or MKV video.");
  if (file.size > 1_073_741_824) throw new Error("The video must be 1 GB or smaller.");
  const prepared = await api.post<CreateVideoReviewResult>(`/session-logs/${sessionLogId}/video`, {
    fileName: file.name,
    contentType,
    sizeBytes: file.size,
    actor: "therapist",
  });
  const response = await fetch(prepared.uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": contentType, "X-Actor": "therapist" },
    body: file,
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error?.message ?? "The local video upload failed.");
  }
  const payload = await response.json();
  return payload.data as VideoReview;
}

export function useUploadSessionVideo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: uploadVideo,
    onSettled: () => qc.invalidateQueries({ queryKey: ["session-logs"] }),
  });
}

export function useProcessSessionVideo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ sessionLogId, actor = "therapist" }: { sessionLogId: number; actor?: string }) =>
      api.post<VideoReview>(`/session-logs/${sessionLogId}/video/process`, { actor }),
    onSettled: () => qc.invalidateQueries({ queryKey: ["session-logs"] }),
  });
}

export function usePrepareVideoHandover() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ studentId, date, slot }: { studentId: number; date: string; slot: Slot }) =>
      api.post<VideoReview | null>("/session-logs/handover-video", { studentId, date, slot, actor: "therapist" }),
    onSettled: () => qc.invalidateQueries({ queryKey: ["session-logs"] }),
  });
}

export const sessionVideoMediaUrl = (sessionLogId: number, clipId?: number) => {
  const query = clipId === undefined ? "" : `?clipId=${clipId}`;
  return `/api/session-logs/${sessionLogId}/video/media${query}`;
};

/** The single-session PDF (what a substitute therapist receives). */
export const logPdfUrl = (id: number) => `/api/session-logs/${id}/pdf`;
