import { useMemo, useState } from "react";
import type { VideoMomentType, VideoReview } from "@/api/types";
import { Badge, Button, Callout, Card, PageHeader, QueryState } from "@/components/ui";
import { useProcessVideoReview, useUploadAndReviewVideo, useVideoReviews } from "./api";

const ACCEPTED_TYPES = ["video/mp4", "video/webm", "video/quicktime", "video/x-matroska"];
const MAX_BYTES = 1_073_741_824;

const MOMENT_LABELS: Record<VideoMomentType, string> = {
  possible_escalation: "Possible escalation",
  recovery: "Recovery",
  notable_progress: "Notable progress",
};

const MOMENT_TONES: Record<VideoMomentType, "danger" | "success" | "info"> = {
  possible_escalation: "danger",
  recovery: "success",
  notable_progress: "info",
};

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.ceil(bytes / 1024)} KB`;
}

function formatTimestamp(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.floor(seconds % 60);
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
}

function validateFile(file: File): string | null {
  if (!ACCEPTED_TYPES.includes(file.type)) return "Choose an MP4, WebM, MOV, or MKV video.";
  if (file.size > MAX_BYTES) return "The video must be 1 GB or smaller.";
  return null;
}

export function VideoReviewPage() {
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const reviews = useVideoReviews();
  const upload = useUploadAndReviewVideo();
  const selectedReview = useMemo(
    () => reviews.data?.find((review) => review.id === upload.data?.id) ?? upload.data,
    [reviews.data, upload.data],
  );

  function chooseFile(nextFile: File | undefined) {
    if (!nextFile) return;
    const error = validateFile(nextFile);
    setFileError(error);
    setFile(error ? null : nextFile);
    upload.reset();
  }

  function startReview() {
    if (file) upload.mutate(file);
  }

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Clinical tools" title="Session video review" />
      <p className="max-w-3xl text-sm text-muted">
        Upload a recorded session to create a concise draft summary and short clips of possible escalation, recovery, and progress.
      </p>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Card title="Upload a recording">
          <div
            className="rounded-xl border-2 border-dashed border-field bg-subtle p-7 text-center"
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              chooseFile(event.dataTransfer.files[0]);
            }}
          >
            <p className="font-bold text-ink">{file ? file.name : "Drop a session video here"}</p>
            <p className="mt-1 text-sm text-muted">
              {file ? formatBytes(file.size) : "MP4, WebM, MOV, or MKV · up to 1 GB"}
            </p>
            <label className="mt-4 inline-flex min-h-10 cursor-pointer items-center rounded-[10px] border border-field bg-white px-4 text-sm font-semibold hover:bg-subtle">
              Choose video
              <input
                className="sr-only"
                type="file"
                accept="video/mp4,video/webm,video/quicktime,video/x-matroska,.mkv"
                onChange={(event) => chooseFile(event.target.files?.[0])}
              />
            </label>
          </div>
          {fileError && <div className="mt-3"><Callout tone="danger">{fileError}</Callout></div>}
          {upload.error && <div className="mt-3"><Callout tone="danger">Review failed: {upload.error.message}</Callout></div>}
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button disabled={!file || upload.isPending} onClick={startReview}>
              {upload.isPending ? "Uploading and reviewing…" : "Upload and create review"}
            </Button>
            {upload.isPending && (
              <span className="text-sm text-muted">A 10 minute video can take several minutes to process.</span>
            )}
          </div>
        </Card>

        <aside>
          <Callout tone="info">
            <div>
              <h2 className="font-bold">Privacy and review</h2>
              <ul className="mt-2 list-disc space-y-2 pl-5 font-normal">
                <li>The original video and generated clips are stored on this backend computer.</li>
                <li>Compressed audio and sampled frames are sent to OpenAI for analysis.</li>
                <li>AI output is a draft for a qualified clinician to check before it is used in records or decisions.</li>
              </ul>
            </div>
          </Callout>
        </aside>
      </div>

      {selectedReview && <ReviewResult review={selectedReview} />}

      <Card title="Previous reviews">
        <QueryState
          isLoading={reviews.isLoading}
          error={reviews.error}
          isEmpty={!reviews.data?.length}
          emptyText="No session videos have been reviewed yet."
        />
        {reviews.data && reviews.data.length > 0 && (
          <div className="space-y-4">
            {reviews.data.map((review) => (
              <ReviewResult key={review.id} review={review} compact={selectedReview?.id === review.id} />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function ReviewResult({ review, compact = false }: { review: VideoReview; compact?: boolean }) {
  const process = useProcessVideoReview();
  if (compact) return null;
  const statusTone =
    review.status === "completed" ? "success" : review.status === "failed" ? "danger" : review.status === "processing" ? "warning" : "neutral";

  return (
    <section className="rounded-xl border border-line bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="font-bold text-ink">{review.originalFilename}</h2>
          <p className="text-xs text-muted">
            {formatBytes(review.sizeBytes)} · {new Date(review.createdAt.replace(" ", "T") + "Z").toLocaleString()}
          </p>
        </div>
        <Badge tone={statusTone}>{review.status.replace("_", " ")}</Badge>
      </div>

      {review.status === "failed" && <p className="mt-3 text-sm font-semibold text-bad">{review.errorMessage ?? "Review failed."}</p>}
      {(review.status === "uploading" || review.status === "uploaded" || review.status === "processing") && (
        <p className="mt-3 text-sm text-muted">
          {review.status === "processing" ? "OpenAI is reviewing the transcript and sampled frames, then local clips will be created." : "Waiting to process this upload."}
        </p>
      )}
      {(review.status === "failed" || review.status === "uploaded") && (
        <div className="mt-3">
          <Button variant="secondary" disabled={process.isPending} onClick={() => process.mutate(review.id)}>
            {process.isPending ? "Reviewing…" : "Retry review"}
          </Button>
          {process.error && <p className="mt-2 text-sm font-semibold text-bad">{process.error.message}</p>}
        </div>
      )}
      {review.summary && (
        <div className="mt-4">
          <h3 className="text-xs font-bold tracking-wider text-muted uppercase">Draft summary</h3>
          <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-ink-soft">{review.summary}</p>
        </div>
      )}

      {review.status === "completed" && (
        <div className="mt-5">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="font-semibold">Important moments</h3>
            <span className="text-xs text-muted">{review.clips.length} clips generated locally</span>
          </div>
          {review.clips.length === 0 ? (
            <p className="rounded-lg bg-subtle p-3 text-sm text-muted">No clear moments met the review threshold.</p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {review.clips.map((clip) => (
                <article key={clip.id} className="overflow-hidden rounded-xl border border-line">
                  <video className="aspect-video w-full bg-ink" controls preload="metadata" src={clip.videoUrl}>
                    Your browser cannot play this clip.
                  </video>
                  <div className="space-y-2 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Badge tone={MOMENT_TONES[clip.eventType]}>{MOMENT_LABELS[clip.eventType]}</Badge>
                      <span className="text-xs tabular-nums text-muted">
                        {formatTimestamp(clip.startSeconds)}–{formatTimestamp(clip.endSeconds)}
                      </span>
                    </div>
                    <p className="text-sm leading-5 text-ink-soft">{clip.caption}</p>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
