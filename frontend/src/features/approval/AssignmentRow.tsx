import { useState } from "react";
import type { ChangeReason, PlanAssignment, ValidationIssue } from "@/api/types";
import { Badge, Button, LinkButton } from "@/components/ui";
import { Icon } from "@/components/icons";
import { formatTime, STEP_LABEL, STEP_TONE } from "@/lib/format";
import { useTherapists } from "@/features/reference/api";
import { useCandidates, useEditAssignment, useRejectAssignment, useUndoAssignmentReject } from "./api";
import { ReasonPicker } from "./ReasonPicker";

/** Column layout shared by the row and the header in DraftPlanCard. Stacks on narrow screens. */
export const ROW_GRID =
  "md:grid md:grid-cols-[96px_minmax(120px,1fr)_minmax(190px,1.3fr)_minmax(200px,1.6fr)_116px] md:gap-4 md:items-start";

/** One changed session in a plan. Drafts can be edited; the backend re-validates after every change. */
export function AssignmentRow({
  a,
  editable,
  issues,
}: {
  a: PlanAssignment;
  editable: boolean;
  issues: ValidationIssue[];
}) {
  const [editing, setEditing] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const isCancel = a.toTherapistId === null;
  const errors = issues.filter((i) => i.level === "error");

  return (
    <div
      id={`assignment-${a.id}`}
      className={`flex flex-col gap-3 border-t border-line-soft px-5 py-4 ${ROW_GRID} ${
        errors.length ? "bg-[#FDF1EF] shadow-[inset_4px_0_0_#C0392B]" : editing ? "bg-[#F3F8F7]" : ""
      }`}
    >
      <div>
        <div className="font-bold">{formatTime(a.startTime)}</div>
        <div className="text-[13px] text-muted">to {formatTime(a.endTime)}</div>
      </div>
      <div>
        <div className="font-bold">{a.studentName}</div>
        <div className="text-[13px] text-muted">
          {a.studentPlan ?? "—"} · <span className="capitalize">{a.location}</span>
        </div>
      </div>

      {editing ? (
        <div className="md:col-span-3">
          <CandidateSelect a={a} onDone={() => setEditing(false)} />
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-1.5">
            <div className="flex flex-wrap items-center gap-2">
              {a.fromTherapistName && (
                <>
                  <span className="text-muted line-through">{a.fromTherapistName}</span>
                  <Icon name="arrow" size={16} className="text-muted" />
                </>
              )}
              <span className={`font-extrabold ${isCancel ? "text-bad" : ""}`}>{isCancel ? "Session cancelled" : a.toTherapistName}</span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge tone={STEP_TONE[a.step]}>{STEP_LABEL[a.step]}</Badge>
              {a.distanceKm !== null && <span className="text-xs text-muted">{a.distanceKm} km away</span>}
            </div>
          </div>
          <div className="flex flex-col gap-2 text-[13px]">
            <ul className="space-y-1 text-ink-soft">
              {a.rationale.map((why) => (
                <li key={why} className="flex gap-2">
                  <span className="mt-[7px] size-[5px] shrink-0 rounded-full bg-[#9AA39F]" aria-hidden="true" />
                  {why}
                </li>
              ))}
            </ul>
            {issues.map((i) =>
              i.level === "error" ? (
                <p key={i.message} className="flex gap-1.5 font-bold text-[#8A2216]">
                  <Icon name="error" size={16} className="mt-px shrink-0" />
                  {i.message}
                </p>
              ) : (
                <p key={i.message} className="rounded-lg bg-warn-bg px-2.5 py-1.5 font-semibold text-warn">
                  {i.message}
                </p>
              ),
            )}
            <RejectedNote ids={a.rejectedTherapistIds} />
          </div>
          <div className="flex flex-wrap items-center gap-1 md:flex-col md:items-end">
            {editable && (
              <Button variant={errors.length ? "primary" : "secondary"} size="sm" onClick={() => setEditing(true)}>
                Change
              </Button>
            )}
            {editable && <RowActions a={a} onReject={() => setRejecting(true)} />}
          </div>
          {rejecting && (
            <div className="md:col-span-5">
              <RejectWithReason a={a} onDone={() => setRejecting(false)} />
            </div>
          )}
        </>
      )}
    </div>
  );
}

/** Reject the proposed therapist, saying why (the reason feeds the preference memory), then re-run this row. */
function RejectWithReason({ a, onDone }: { a: PlanAssignment; onDone: () => void }) {
  const reject = useRejectAssignment();
  const [reason, setReason] = useState<ChangeReason | null>(null);
  return (
    <div className="flex flex-col gap-2.5 md:ml-[112px] md:max-w-xl">
      <ReasonPicker name={`reject-reason-${a.id}`} therapistName={a.toTherapistName ?? "this therapist"} value={reason} onChange={setReason} />
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          disabled={!reason || reject.isPending}
          onClick={() => reject.mutate({ planId: a.planId, assignmentId: a.id, reason }, { onSuccess: onDone })}
        >
          {reject.isPending ? "Working…" : `Reject ${a.toTherapistName} and find the next best`}
        </Button>
        <Button size="sm" variant="secondary" onClick={onDone}>
          Back
        </Button>
        {reject.error && <span className="text-sm font-semibold text-bad">{reject.error.message}</span>}
      </div>
    </div>
  );
}

/** Reject this row's proposal (re-run just this row) or undo the last reject. */
function RowActions({ a, onReject }: { a: PlanAssignment; onReject: () => void }) {
  const reject = useRejectAssignment();
  const undo = useUndoAssignmentReject();
  const busy = reject.isPending || undo.isPending;
  const ids = { planId: a.planId, assignmentId: a.id };

  if (a.chainId) {
    return (
      <span className="px-1.5 py-1 text-xs text-muted" title="Part of a swap: reject the whole swap plan instead">
        Part of a swap
      </span>
    );
  }
  return (
    <>
      <LinkButton
        tone={a.toTherapistId === null ? "brand" : "danger"}
        disabled={busy}
        onClick={() => (a.toTherapistId === null ? reject.mutate(ids) : onReject())}
        title={
          a.toTherapistId === null
            ? "Look again for a free therapist for this session"
            : `Reject ${a.toTherapistName} for this session and pick the next best free therapist`
        }
      >
        {reject.isPending ? "Working…" : a.toTherapistId === null ? "Look again" : "Reject"}
      </LinkButton>
      {a.canUndo && (
        <LinkButton disabled={busy} onClick={() => undo.mutate(ids)}>
          Undo reject
        </LinkButton>
      )}
      {(reject.error || undo.error) && <span className="text-xs font-semibold text-bad">{(reject.error ?? undo.error)!.message}</span>}
    </>
  );
}

function RejectedNote({ ids }: { ids: number[] }) {
  const { data: therapists = [] } = useTherapists();
  if (ids.length === 0) return null;
  const names = ids.map((id) => therapists.find((t) => t.id === id)?.name ?? `#${id}`);
  return <p className="text-muted">You rejected: {names.join(", ")}</p>;
}

/** Pick a replacement from the ranked candidate list (radio list: best first, then unavailable, then cancel). */
function CandidateSelect({ a, onDone }: { a: PlanAssignment; onDone: () => void }) {
  const { data = [], isLoading } = useCandidates(a.planId, a.id, true);
  const edit = useEditAssignment();
  const [value, setValue] = useState(a.toTherapistId === null ? "cancel" : String(a.toTherapistId));
  const [reason, setReason] = useState<ChangeReason | null>(null);
  // Moving a PROPOSED therapist off the session needs a reason (it's how the preference memory learns).
  const replacing = a.toTherapistId !== null && value !== String(a.toTherapistId);

  const save = () =>
    edit.mutate(
      { planId: a.planId, assignmentId: a.id, toTherapistId: value === "cancel" ? null : Number(value), reason: replacing ? reason : null },
      { onSuccess: onDone },
    );

  if (isLoading) return <span className="text-sm text-muted">Loading options…</span>;
  const available = data.filter((c) => c.available);
  const unavailable = data.filter((c) => !c.available);
  const name = `candidate-${a.id}`;

  const option = (key: string, content: React.ReactNode, muted = false) => (
    <label
      key={key}
      className={`flex cursor-pointer items-center gap-3 border-t border-line-soft px-3.5 py-2.5 text-sm first:border-t-0 has-checked:bg-brand-soft ${muted ? "text-[#6B716E]" : ""}`}
    >
      <input type="radio" name={name} value={key} checked={value === key} onChange={() => setValue(key)} className="size-4 accent-brand" />
      {content}
    </label>
  );

  return (
    <fieldset className="flex flex-col gap-2.5">
      <legend className="mb-2.5 text-[13px] font-bold text-ink-soft">
        Who covers {a.studentName}
        {a.fromTherapistName ? ` instead of ${a.fromTherapistName}` : ""}?
      </legend>
      <div className="max-h-80 overflow-y-auto rounded-xl border border-field bg-white">
        <div className="bg-[#F3FAF5] px-3.5 py-2 text-xs font-bold text-good">Available — best first</div>
        {available.length === 0 && <p className="px-3.5 py-2.5 text-sm text-muted">Nobody is free for this session.</p>}
        {available.map((c) =>
          option(
            String(c.therapistId),
            <>
              <span className="font-bold">{c.therapistName}</span>
              <span className="text-[13px] text-muted">{c.rank}</span>
              <Badge tone={STEP_TONE[c.step]}>{STEP_LABEL[c.step]}</Badge>
              {c.rejected && <Badge tone="danger">rejected by you</Badge>}
              {c.avoided && (
                <span title={c.preferenceNotes.join("\n")}>
                  <Badge tone="warning">avoid rule</Badge>
                </span>
              )}
              {c.distanceKm !== null && <span className="ml-auto text-[13px] text-muted">{c.distanceKm} km</span>}
            </>,
          ),
        )}
        {unavailable.length > 0 && (
          <div className="border-t border-line-soft bg-subtle px-3.5 py-2 text-xs font-bold text-muted">Not available — will fail validation</div>
        )}
        {unavailable.map((c) =>
          option(
            String(c.therapistId),
            <>
              <span className="font-bold">{c.therapistName}</span>
              <span className="text-[13px]">{c.rank}</span>
              <span className="ml-auto text-right text-[13px]">{c.unavailableReason}</span>
            </>,
            true,
          ),
        )}
        <div className="border-t border-line-soft">{option("cancel", <span className="font-bold text-bad">Cancel this session instead</span>)}</div>
      </div>
      {replacing && (
        <ReasonPicker name={`edit-reason-${a.id}`} therapistName={a.toTherapistName ?? "this therapist"} value={reason} onChange={setReason} />
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={save} disabled={edit.isPending || (replacing && !reason)}>
          {edit.isPending ? "Saving…" : "Save"}
        </Button>
        <Button variant="secondary" onClick={onDone}>
          Back
        </Button>
        {edit.error && <span className="text-sm font-semibold text-bad">{edit.error.message}</span>}
      </div>
    </fieldset>
  );
}
