import { useState } from "react";
import type { SchedulingPreference } from "@/api/types";
import { Badge, Button, LinkButton } from "@/components/ui";
import { formatCaseDate, formatTime, formatTimestamp, PREFERENCE_STATUS_LABEL, REASON_LABEL } from "@/lib/format";
import {
  useConfirmPreference,
  useEditPreference,
  usePausePreference,
  useRejectPreference,
  useRemovePreference,
  useResumePreference,
} from "./api";
import { PreferenceForm } from "./PreferenceForm";

const STATUS_TONE = { suggested: "warning", active: "success", paused: "neutral", rejected: "neutral", removed: "neutral" } as const;
const SOURCE_LABEL = { pattern: "Learned from your changes", admin: "Added by an admin", agent_prompt: "From an AI agent instruction" };

/** One suggestion or rule: what it says, why (evidence), who confirmed it, and what the admin can do with it. */
export function PreferenceCard({ p }: { p: SchedulingPreference }) {
  const [mode, setMode] = useState<"view" | "confirm" | "edit">("view");
  const confirm = useConfirmPreference();
  const reject = useRejectPreference();
  const edit = useEditPreference();
  const pause = usePausePreference();
  const resume = useResumePreference();
  const remove = useRemovePreference();
  const busy = [confirm, reject, edit, pause, resume, remove].some((m) => m.isPending);
  const actionError = [reject, pause, resume, remove].find((m) => m.error)?.error;

  return (
    <article className="flex flex-col gap-3 border-t border-line-soft px-5 py-4 first:border-t-0">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={STATUS_TONE[p.status]}>{PREFERENCE_STATUS_LABEL[p.status]}</Badge>
        <Badge tone={p.strength === "hard" ? "danger" : "info"}>{p.strength === "hard" ? "Never" : "Avoid"}</Badge>
        <Badge>{p.type === "pairing" ? "Therapist ↔ child" : "Time availability"}</Badge>
        <span className="ml-auto text-xs text-muted">
          #{p.id} · {SOURCE_LABEL[p.source]}
        </span>
      </div>

      {p.status === "suggested" && p.question ? (
        <p className="text-[15px] font-semibold">{p.question}</p>
      ) : (
        <p className="text-[15px] font-bold">{p.summary}</p>
      )}

      <dl className="flex flex-wrap gap-x-6 gap-y-1 text-[13px] text-muted">
        {p.reason && (
          <div>
            <dt className="inline font-semibold">Reason: </dt>
            <dd className="inline">{p.reason}</dd>
          </div>
        )}
        {p.confirmedBy && (
          <div>
            <dt className="inline font-semibold">Confirmed by: </dt>
            <dd className="inline">
              {p.confirmedBy}
              {p.confirmedAt ? `, ${formatTimestamp(p.confirmedAt)}` : ""}
            </dd>
          </div>
        )}
        <div>
          <dt className="inline font-semibold">Last change: </dt>
          <dd className="inline">{formatTimestamp(p.updatedAt)}</dd>
        </div>
      </dl>

      {p.agentPrompt && <p className="rounded-lg bg-subtle px-3 py-2 text-[13px]">Instruction: “{p.agentPrompt}”</p>}

      {p.evidence.length > 0 && (
        <details className="text-[13px]">
          <summary className="cursor-pointer font-semibold text-brand">Evidence: {p.evidence.length} change{p.evidence.length === 1 ? "" : "s"} by admins</summary>
          <ul className="mt-2 space-y-1.5">
            {p.evidence.map((e) => (
              <li key={e.eventId} className="rounded-lg bg-subtle px-3 py-2">
                <span className="font-semibold">{formatCaseDate(e.date)}</span> {formatTime(e.startTime)}–{formatTime(e.endTime)} ·{" "}
                {e.studentName}: {e.removedTherapistName} {e.action === "rejected" ? "rejected" : "replaced"}
                {e.newTherapistName ? ` → ${e.newTherapistName}` : " → session cancelled"} · “
                {e.reasonCode ? REASON_LABEL[e.reasonCode] : "no reason"}”{e.reasonNote ? ` — ${e.reasonNote}` : ""} ({e.actor})
              </li>
            ))}
          </ul>
        </details>
      )}

      {mode === "confirm" && (
        <div className="rounded-xl border border-field p-4">
          <PreferenceForm
            type={p.type}
            initial={p}
            submitLabel="Confirm rule"
            pending={confirm.isPending}
            error={confirm.error}
            onCancel={() => setMode("view")}
            onSubmit={(input) => confirm.mutate({ id: p.id, ...input }, { onSuccess: () => setMode("view") })}
          />
        </div>
      )}
      {mode === "edit" && (
        <div className="rounded-xl border border-field p-4">
          <PreferenceForm
            type={p.type}
            initial={p}
            submitLabel="Save changes"
            pending={edit.isPending}
            error={edit.error}
            onCancel={() => setMode("view")}
            onSubmit={(input) => edit.mutate({ id: p.id, ...input }, { onSuccess: () => setMode("view") })}
          />
        </div>
      )}

      {mode === "view" && (
        <div className="flex flex-wrap items-center gap-2">
          {p.status === "suggested" && (
            <>
              <Button size="sm" onClick={() => setMode("confirm")} disabled={busy}>
                Yes, make it a rule…
              </Button>
              <Button size="sm" variant="secondary" onClick={() => reject.mutate({ id: p.id })} disabled={busy}>
                No, not a rule
              </Button>
            </>
          )}
          {(p.status === "active" || p.status === "paused") && (
            <LinkButton onClick={() => setMode("edit")} disabled={busy}>
              Edit
            </LinkButton>
          )}
          {p.status === "active" && (
            <LinkButton onClick={() => pause.mutate(p.id)} disabled={busy}>
              Pause
            </LinkButton>
          )}
          {p.status === "paused" && (
            <LinkButton onClick={() => resume.mutate(p.id)} disabled={busy}>
              Resume
            </LinkButton>
          )}
          {(p.status === "active" || p.status === "paused") && (
            <LinkButton
              tone="danger"
              disabled={busy}
              onClick={() => window.confirm(`Remove rule #${p.id}? It will stop applying (it stays in the history).`) && remove.mutate(p.id)}
            >
              Remove
            </LinkButton>
          )}
          {actionError && <span className="text-sm font-semibold text-bad">{actionError.message}</span>}
        </div>
      )}
    </article>
  );
}
