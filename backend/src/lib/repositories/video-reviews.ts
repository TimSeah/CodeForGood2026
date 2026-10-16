import { getDb } from "@/lib/db/client";
import type { VideoMomentType, VideoReview, VideoReviewClip, VideoReviewStatus } from "@/lib/types";

interface VideoReviewRow {
  id: number;
  session_log_id: number | null;
  storage_path: string;
  original_filename: string;
  content_type: string;
  size_bytes: number;
  status: VideoReviewStatus;
  summary: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

interface VideoReviewClipRow {
  id: number;
  review_id: number;
  start_seconds: number;
  end_seconds: number;
  event_type: VideoMomentType;
  title: string;
  caption: string;
  confidence: number;
  storage_path: string;
}

export interface StoredVideoReviewClip extends VideoReviewClip {
  storagePath: string;
}

export interface StoredVideoReview extends Omit<VideoReview, "clips"> {
  storagePath: string;
  clips: StoredVideoReviewClip[];
}

export interface VideoReviewClipInput {
  startSeconds: number;
  endSeconds: number;
  eventType: VideoMomentType;
  title: string;
  caption: string;
  confidence: number;
  storagePath: string;
}

const toClip = (row: VideoReviewClipRow): StoredVideoReviewClip => ({
  id: row.id,
  startSeconds: row.start_seconds,
  endSeconds: row.end_seconds,
  eventType: row.event_type,
  title: row.title,
  caption: row.caption,
  confidence: row.confidence,
  storagePath: row.storage_path,
});

function clipsFor(reviewId: number): StoredVideoReviewClip[] {
  return (
    getDb()
      .prepare("SELECT * FROM video_review_clips WHERE review_id = ? ORDER BY start_seconds")
      .all(reviewId) as VideoReviewClipRow[]
  ).map(toClip);
}

const toReview = (row: VideoReviewRow): StoredVideoReview => ({
  id: row.id,
  sessionLogId: row.session_log_id!,
  storagePath: row.storage_path,
  originalFilename: row.original_filename,
  contentType: row.content_type,
  sizeBytes: row.size_bytes,
  status: row.status,
  summary: row.summary,
  errorMessage: row.error_message,
  clips: clipsFor(row.id),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export function listVideoReviews(limit = 30): StoredVideoReview[] {
  return (getDb().prepare("SELECT * FROM video_reviews ORDER BY id DESC LIMIT ?").all(limit) as VideoReviewRow[]).map(toReview);
}

export function getVideoReview(id: number): StoredVideoReview | null {
  const row = getDb().prepare("SELECT * FROM video_reviews WHERE id = ?").get(id) as VideoReviewRow | undefined;
  return row ? toReview(row) : null;
}

export function getVideoReviewForSessionLog(sessionLogId: number): StoredVideoReview | null {
  const row = getDb()
    .prepare("SELECT * FROM video_reviews WHERE session_log_id = ?")
    .get(sessionLogId) as VideoReviewRow | undefined;
  return row ? toReview(row) : null;
}

/** Most recent earlier session video for a child, used to prepare an incoming cover therapist. */
export function getLatestVideoForStudent(studentId: number, date: string, slot: "AM" | "PM"): StoredVideoReview | null {
  const row = getDb()
    .prepare(
      `SELECT vr.* FROM video_reviews vr
       JOIN session_logs sl ON sl.id = vr.session_log_id
       WHERE sl.student_id = ?
         AND (sl.date < ? OR (sl.date = ? AND sl.slot < ?))
       ORDER BY sl.date DESC, CASE sl.slot WHEN 'PM' THEN 1 ELSE 0 END DESC, vr.id DESC
       LIMIT 1`,
    )
    .get(studentId, date, date, slot) as VideoReviewRow | undefined;
  return row ? toReview(row) : null;
}

/** Domain shape for session-log responses; storage paths never leave the repository. */
export function getSessionLogVideo(sessionLogId: number): VideoReview | null {
  const stored = getVideoReviewForSessionLog(sessionLogId);
  if (!stored) return null;
  const { storagePath: _storagePath, clips, ...review } = stored;
  return {
    ...review,
    clips: clips.map(({ storagePath: _clipStoragePath, ...clip }) => clip),
  };
}

export function createVideoReview(input: {
  sessionLogId: number;
  storagePath: string;
  originalFilename: string;
  contentType: string;
  sizeBytes: number;
}): number {
  const result = getDb()
    .prepare(
      `INSERT INTO video_reviews (session_log_id, storage_path, original_filename, content_type, size_bytes)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .run(input.sessionLogId, input.storagePath, input.originalFilename, input.contentType, input.sizeBytes);
  return Number(result.lastInsertRowid);
}

export function setVideoReviewStatus(id: number, status: VideoReviewStatus, errorMessage: string | null = null) {
  getDb()
    .prepare(
      `UPDATE video_reviews
       SET status = ?, error_message = ?, updated_at = datetime('now')
       WHERE id = ?`,
    )
    .run(status, errorMessage, id);
}

export function completeVideoReview(id: number, summary: string, clips: VideoReviewClipInput[]) {
  const db = getDb();
  db.prepare("DELETE FROM video_review_clips WHERE review_id = ?").run(id);
  const insert = db.prepare(
    `INSERT INTO video_review_clips
     (review_id, start_seconds, end_seconds, event_type, title, caption, confidence, storage_path)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  for (const clip of clips) {
    insert.run(id, clip.startSeconds, clip.endSeconds, clip.eventType, clip.title, clip.caption, clip.confidence, clip.storagePath);
  }
  db.prepare(
    `UPDATE video_reviews
     SET status = 'completed', summary = ?, error_message = NULL, updated_at = datetime('now')
     WHERE id = ?`,
  ).run(summary, id);
}
