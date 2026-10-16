import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/api/client";
import type { CreateVideoReviewResult, VideoReview } from "@/api/types";

const queryKey = ["video-reviews"] as const;

export const useVideoReviews = () =>
  useQuery({
    queryKey,
    queryFn: () => api.get<VideoReview[]>("/video-reviews"),
  });

async function uploadAndReview(file: File): Promise<VideoReview> {
  const created = await api.post<CreateVideoReviewResult>("/video-reviews", {
    fileName: file.name,
    contentType: file.type,
    sizeBytes: file.size,
    actor: "admin",
  });

  const uploadResponse = await fetch(created.uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": file.type, "X-Actor": "admin" },
    body: file,
  });
  if (!uploadResponse.ok) {
    const payload = await uploadResponse.json().catch(() => null);
    throw new ApiError(uploadResponse.status, payload?.error?.message ?? "The local video upload failed.");
  }

  return api.post<VideoReview>(`/video-reviews/${created.review.id}/process`, { actor: "admin" });
}

export function useUploadAndReviewVideo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: uploadAndReview,
    onSettled: () => queryClient.invalidateQueries({ queryKey }),
  });
}

export function useProcessVideoReview() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.post<VideoReview>(`/video-reviews/${id}/process`, { actor: "admin" }),
    onSettled: () => queryClient.invalidateQueries({ queryKey }),
  });
}
