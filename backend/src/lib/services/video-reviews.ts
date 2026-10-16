import { randomUUID } from "node:crypto";
import { rm, stat } from "node:fs/promises";
import { getDb } from "@/lib/db/client";
import { HttpError } from "@/lib/http";
import { logAudit } from "@/lib/repositories/audit";
import {
  completeVideoReview,
  createVideoReview,
  getVideoReview,
  getVideoReviewForSessionLog,
  getLatestVideoForStudent,
  getSessionLogVideo,
  setVideoReviewStatus,
  type StoredVideoReview,
} from "@/lib/repositories/video-reviews";
import type { CreateVideoReviewResult, VideoReview } from "@/lib/types";
import { getSessionLog } from "@/lib/repositories/session-logs";
import { analyzeSessionVideo } from "./openai-video";
import { assertLocalVideo, resolveVideoStoragePath, storagePathFor, writeVideoUpload } from "./local-video";

const EXTENSIONS: Record<string, string> = {
  "video/mp4": ".mp4",
  "video/webm": ".webm",
  "video/quicktime": ".mov",
  "video/x-matroska": ".mkv",
};

function exposeReview(stored: StoredVideoReview): VideoReview {
  return getSessionLogVideo(stored.sessionLogId)!;
}

function getReviewOrThrow(id: number): StoredVideoReview {
  const review = getVideoReview(id);
  if (!review) throw new HttpError(404, `Video review ${id} not found`);
  return review;
}

export function prepareSessionVideoUpload(
  sessionLogId: number,
  input: { fileName: string; contentType: string; sizeBytes: number },
  actor: string,
): CreateVideoReviewResult {
  if (!getSessionLog(sessionLogId)) throw new HttpError(404, `Session log ${sessionLogId} not found`);
  const attached = getVideoReviewForSessionLog(sessionLogId);
  if (attached) {
    if (
      attached.status === "uploading" &&
      attached.originalFilename === input.fileName &&
      attached.sizeBytes === input.sizeBytes
    ) {
      return { review: exposeReview(attached), uploadUrl: `/api/session-logs/${sessionLogId}/video/upload` };
    }
    throw new HttpError(409, "This session log already has a video attached.");
  }
  const storagePath = storagePathFor(
    new Date().toISOString().slice(0, 10),
    randomUUID(),
    `source${EXTENSIONS[input.contentType] ?? ".mp4"}`,
  );
  const id = getDb().transaction(() => {
    const reviewId = createVideoReview({
      sessionLogId,
      storagePath,
      originalFilename: input.fileName,
      contentType: input.contentType,
      sizeBytes: input.sizeBytes,
    });
    logAudit({
      actor,
      action: "session_video.upload_started",
      entityType: "session_log",
      entityId: sessionLogId,
      details: { fileName: input.fileName, sizeBytes: input.sizeBytes, storage: "local" },
    });
    return reviewId;
  })();
  return { review: exposeReview(getReviewOrThrow(id)), uploadUrl: `/api/session-logs/${sessionLogId}/video/upload` };
}

export async function saveSessionVideoUpload(
  sessionLogId: number,
  body: ReadableStream<Uint8Array> | null,
  actor: string,
): Promise<VideoReview> {
  const review = getVideoReviewForSessionLog(sessionLogId);
  if (!review) throw new HttpError(404, `No video upload was started for session log ${sessionLogId}`);
  if (review.status !== "uploading") throw new HttpError(409, "This video has already been uploaded.");
  const written = await writeVideoUpload(review.storagePath, body, review.sizeBytes);
  getDb().transaction(() => {
    setVideoReviewStatus(review.id, "uploaded");
    logAudit({
      actor,
      action: "session_video.uploaded",
      entityType: "session_log",
      entityId: review.sessionLogId,
      details: { sizeBytes: written, storage: "local" },
    });
  })();
  return exposeReview(getReviewOrThrow(review.id));
}

export async function processSessionVideo(id: number, actor: string): Promise<VideoReview> {
  const review = getReviewOrThrow(id);
  if (review.status === "completed") return exposeReview(review);
  if (review.status === "processing") throw new HttpError(409, "This video is already being processed.");
  if (review.status === "uploading") throw new HttpError(409, "Upload the video before starting the review.");

  await assertLocalVideo(review.storagePath, review.sizeBytes);
  getDb().transaction(() => {
    setVideoReviewStatus(id, "processing");
    logAudit({ actor, action: "session_video.processing", entityType: "session_log", entityId: review.sessionLogId });
  })();

  try {
    const analysis = await analyzeSessionVideo(review.storagePath);
    getDb().transaction(() => {
      completeVideoReview(id, analysis.summary, analysis.clips);
      logAudit({
        actor,
        action: "session_video.completed",
        entityType: "session_log",
        entityId: review.sessionLogId,
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
        action: "session_video.failed",
        entityType: "session_log",
        entityId: review.sessionLogId,
        details: { message: message.slice(0, 500), provider: "openai" },
      });
    })();
    throw error;
  }
}

export async function processSessionLogVideo(sessionLogId: number, actor: string): Promise<VideoReview> {
  const review = getVideoReviewForSessionLog(sessionLogId);
  if (!review) throw new HttpError(404, `No video is attached to session log ${sessionLogId}`);
  return processSessionVideo(review.id, actor);
}

/** Process the most recent earlier recording when an approved plan assigns a new therapist. */
export async function processPreviousVideoForTakeover(
  studentId: number,
  date: string,
  slot: "AM" | "PM",
  actor: string,
): Promise<VideoReview | null> {
  const review = getLatestVideoForStudent(studentId, date, slot);
  if (!review || review.status === "uploading" || review.status === "processing" || review.status === "completed") {
    return review ? exposeReview(review) : null;
  }
  return processSessionVideo(review.id, actor);
}

export async function getSessionVideoMedia(
  sessionLogId: number,
  clipId?: number,
): Promise<{ path: string; contentType: string; size: number }> {
  const review = getVideoReviewForSessionLog(sessionLogId);
  if (!review) throw new HttpError(404, `No video is attached to session log ${sessionLogId}`);
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

/** Remove local media after its owning session log has been deleted. */
export async function removeSessionVideoFiles(review: StoredVideoReview | null): Promise<void> {
  if (!review) return;
  const paths = [review.storagePath, ...review.clips.map((clip) => clip.storagePath)];
  await Promise.all(paths.map((relativePath) => rm(resolveVideoStoragePath(relativePath), { force: true }).catch(() => undefined)));
}
