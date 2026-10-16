import type { SessionLog } from "@/api/types";
import { Badge, Button } from "@/components/ui";
import { sessionVideoMediaUrl, useProcessSessionVideo } from "./api";

function timestamp(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = Math.floor(seconds % 60);
  return hours > 0
    ? `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`
    : `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
}

const STATUS_LABEL: Record<NonNullable<SessionLog["videoReview"]>["status"], string> = {
  uploading: "Upload incomplete",
  uploaded: "Ready to summarize",
  processing: "Generating highlights",
  completed: "Highlights ready",
  failed: "Could not process",
};

/** A recording remains untouched until a therapist requests highlights or a cover plan is approved. */
export function SessionVideoPanel({ log, expanded = false }: { log: SessionLog; expanded?: boolean }) {
  const review = log.videoReview;
  const process = useProcessSessionVideo();
  if (!review) return null;

  return (
    <details open={expanded || undefined} className="rounded-xl border border-line-soft bg-subtle/50 p-3 text-left">
      <summary className="flex cursor-pointer list-none flex-wrap items-center gap-2 text-sm font-bold text-ink">
        <span>Session video</span>
        <Badge tone={review.status === "completed" ? "success" : review.status === "failed" ? "danger" : "info"}>
          {STATUS_LABEL[review.status]}
        </Badge>
        <span className="font-normal text-muted">{review.originalFilename}</span>
      </summary>
      <div className="mt-3 space-y-3">
        {review.summary && <p className="text-sm leading-6 text-ink-soft">{review.summary}</p>}
        {review.status === "uploading" && <p className="text-sm text-muted">The upload did not finish. Reattach the file to retry it.</p>}
        {(review.status === "uploaded" || review.status === "failed") && (
          <Button type="button" size="sm" disabled={process.isPending} onClick={() => process.mutate({ sessionLogId: log.id })}>
            {process.isPending ? "Processing…" : review.status === "failed" ? "Retry highlights" : "Generate gist and clips"}
          </Button>
        )}
        {review.status === "processing" && <p className="text-sm text-muted">The recording is being summarized.</p>}
        {(review.errorMessage || process.error) && <p className="text-sm font-semibold text-bad">{process.error?.message ?? review.errorMessage}</p>}
        {review.clips.length > 0 && (
          <ul className="grid gap-3 md:grid-cols-2">
            {review.clips.map((clip) => (
              <li key={clip.id} className="overflow-hidden rounded-xl border border-line bg-white">
                <video
                  className="aspect-video w-full bg-ink"
                  controls
                  preload="metadata"
                  src={sessionVideoMediaUrl(log.id, clip.id)}
                  aria-label={`${clip.title}, ${timestamp(clip.startSeconds)} to ${timestamp(clip.endSeconds)}`}
                />
                <div className="space-y-1 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h4 className="font-bold text-ink">{clip.title}</h4>
                    <Badge>{timestamp(clip.startSeconds)}–{timestamp(clip.endSeconds)}</Badge>
                  </div>
                  <p className="text-xs leading-5 text-muted">{clip.caption}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </details>
  );
}
