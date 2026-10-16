import { randomUUID } from "node:crypto";
import { stat } from "node:fs/promises";
import { getDb } from "@/lib/db/client";
import { HttpError } from "@/lib/http";
import { logAudit } from "@/lib/repositories/audit";
import {
  completeVideoReview,
  createVideoReview,
  getVideoReview,
  listVideoReviews,
  setVideoReviewStatus,
  type StoredVideoReview,
} from "@/lib/repositories/video-reviews";
import type { CreateVideoReviewResult, VideoReview } from "@/lib/types";
import { analyzeSessionVideo } from "./openai-video";
import { assertLocalVideo, resolveVideoStoragePath, storagePathFor, writeVideoUpload } from "./local-video";

const EXTENSIONS: Record<string, string> = {
  "video/mp4": ".mp4",
  "video/webm": ".webm",
  "video/quicktime": ".mov",
  "video/x-matroska": ".mkv",
};

function exposeReview(stored: StoredVideoReview): VideoReview {
  const { storagePath: _storagePath, clips, ...review } = stored;
  return {
    ...review,
    videoUrl: review.status === "uploading" ? null : `/api/video-reviews/${review.id}/media`,
    clips: clips.map(({ storagePath: _clipPath, ...clip }) => ({
      ...clip,
      videoUrl: `/api/video-reviews/${review.id}/media?clipId=${clip.id}`,
    })),
  };
}

function getReviewOrThrow(id: number): StoredVideoReview {
  const review = getVideoReview(id);
  if (!review) throw new HttpError(404, `Video review ${id} not found`);
  return review;
}

export function listSessionVideoReviews(): VideoReview[] {
  return listVideoReviews().map(exposeReview);
}

export function prepareSessionVideoUpload(
  input: { fileName: string; contentType: string; sizeBytes: number },
  actor: string,
): CreateVideoReviewResult {
  const storagePath = storagePathFor(
    new Date().toISOString().slice(0, 10),
    randomUUID(),
    `source${EXTENSIONS[input.contentType] ?? ".mp4"}`,
  );
  const id = getDb().transaction(() => {
    const reviewId = createVideoReview({
      storagePath,
      originalFilename: input.fileName,
      contentType: input.contentType,
      sizeBytes: input.sizeBytes,
    });
    logAudit({
      actor,
      action: "video_review.created",
      entityType: "video_review",
      entityId: reviewId,
      details: { fileName: input.fileName, sizeBytes: input.sizeBytes, storage: "local" },
    });
    return reviewId;
  })();
  return { review: exposeReview(getReviewOrThrow(id)), uploadUrl: `/api/video-reviews/${id}/upload` };
}

export async function saveSessionVideoUpload(
  id: number,
  body: ReadableStream<Uint8Array> | null,
  actor: string,
): Promise<VideoReview> {
  const review = getReviewOrThrow(id);
  if (review.status !== "uploading") throw new HttpError(409, "This video has already been uploaded.");
  const written = await writeVideoUpload(review.storagePath, body, review.sizeBytes);
  getDb().transaction(() => {
    setVideoReviewStatus(id, "uploaded");
    logAudit({
      actor,
      action: "video_review.uploaded",
      entityType: "video_review",
      entityId: id,
      details: { sizeBytes: written, storage: "local" },
    });
  })();
  return exposeReview(getReviewOrThrow(id));
}

export async function processSessionVideo(id: number, actor: string): Promise<VideoReview> {
  const review = getReviewOrThrow(id);
  if (review.status === "completed") return exposeReview(review);
  if (review.status === "processing") throw new HttpError(409, "This video is already being processed.");
  if (review.status === "uploading") throw new HttpError(409, "Upload the video before starting the review.");

  await assertLocalVideo(review.storagePath, review.sizeBytes);
  getDb().transaction(() => {
    setVideoReviewStatus(id, "processing");
    logAudit({ actor, action: "video_review.processing", entityType: "video_review", entityId: id });
  })();

  try {
    const analysis = await analyzeSessionVideo(review.storagePath);
    getDb().transaction(() => {
      completeVideoReview(id, analysis.summary, analysis.clips);
      logAudit({
        actor,
        action: "video_review.completed",
        entityType: "video_review",
        entityId: id,
        details: { clips: analysis.clips.length, provider: "openai" },
      });
    })();
    return exposeReview(getReviewOrThrow(id));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Video analysis failed";
    getDb().transaction(() => {
      setVideoReviewStatus(id, "failed", message.slice(0, 1_000));
      logAudit({
        actor,
        action: "video_review.failed",
        entityType: "video_review",
        entityId: id,
        details: { message: message.slice(0, 500), provider: "openai" },
      });
    })();
    throw error;
  }
}

export async function getSessionVideoMedia(
  id: number,
  clipId?: number,
): Promise<{ path: string; contentType: string; size: number }> {
  const review = getReviewOrThrow(id);
  const relativePath =
    clipId === undefined
      ? review.storagePath
      : review.clips.find((clip) => clip.id === clipId)?.storagePath;
  if (!relativePath) throw new HttpError(404, "Video clip not found.");
  const absolutePath = await assertLocalVideo(relativePath);
  const details = await stat(absolutePath);
  return {
    path: absolutePath,
    contentType: clipId === undefined ? review.contentType : "video/mp4",
    size: details.size,
  };
}
