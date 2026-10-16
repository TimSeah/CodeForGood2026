import { useState } from "react";
import type { PlanAssignment, ValidationIssue } from "@/api/types";
import { Badge, Button, inputClass } from "@/components/ui";
import { formatTime, STEP_LABEL, STEP_TONE } from "@/lib/format";
import { useTherapists } from "@/features/reference/api";
import { useCandidates, useEditAssignment, useRejectAssignment, useUndoAssignmentReject } from "./api";

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
  const isCancel = a.toTherapistId === null;
  const errors = issues.filter((i) => i.level === "error");

  return (
    <tr className={`align-top ${errors.length ? "bg-rose-50" : ""}`}>
      <td className="py-2 pr-2 whitespace-nowrap">
        <Badge>{a.slot}</Badge>
        <div className="mt-1 text-xs text-slate-500">
          {formatTime(a.startTime)}–{formatTime(a.endTime)}
        </div>
      </td>
      <td className="pr-2">
        <div className="font-medium">{a.studentName}</div>
        <div className="text-xs text-slate-500">
          {a.studentPlan ?? "—"} · <span className="capitalize">{a.location}</span>
        </div>
      </td>
      <td className="pr-2 text-slate-500">{a.fromTherapistName ?? "—"}</td>
      <td className="pr-2">
        {editing ? (
          <CandidateSelect a={a} onDone={() => setEditing(false)} />
        ) : (
          <div className="flex flex-wrap items-center gap-1">
            <span className={isCancel ? "font-medium text-rose-600" : "font-medium"}>{isCancel ? "Cancel session" : a.toTherapistName}</span>
            <Badge tone={STEP_TONE[a.step]}>{STEP_LABEL[a.step]}</Badge>
            {a.distanceKm !== null && <span className="text-xs text-slate-500">{a.distanceKm} km</span>}
            {editable && (
              <button className="text-xs text-sky-700 underline" onClick={() => setEditing(true)}>
                change
              </button>
            )}
          </div>
        )}
      </td>
      <td className="text-xs text-slate-600">
        <ul className="list-disc space-y-0.5 pl-4">
          {a.rationale.map((why) => (
            <li key={why}>{why}</li>
          ))}
        </ul>
        {issues.map((i) => (
          <p key={i.message} className={i.level === "error" ? "mt-1 font-medium text-rose-700" : "mt-1 text-amber-700"}>
            {i.level === "error" ? "✖" : "⚠"} {i.message}
          </p>
        ))}
        <RejectedNote ids={a.rejectedTherapistIds} />
      </td>
      <td className="pl-2 text-right">{editable && !editing && <RowActions a={a} />}</td>
    </tr>
  );
}

/** Reject this row's proposal (re-run just this row) or undo the last reject. */
function RowActions({ a }: { a: PlanAssignment }) {
  const reject = useRejectAssignment();
  const undo = useUndoAssignmentReject();
  const busy = reject.isPending || undo.isPending;
  const ids = { planId: a.planId, assignmentId: a.id };

  if (a.chainId) {
    return <span className="text-xs text-slate-400" title="Part of a swap: reject the whole swap plan instead">swap</span>;
  }
  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        variant="secondary"
        disabled={busy}
        onClick={() => reject.mutate(ids)}
        title={
          a.toTherapistId === null
            ? "Look again for a free therapist for this session"
            : `Reject ${a.toTherapistName} for this session and pick the next best free therapist`
        }
      >
        {reject.isPending ? "…" : a.toTherapistId === null ? "Retry" : "Reject"}
      </Button>
      {a.canUndo && (
        <button className="text-xs text-sky-700 underline disabled:opacity-50" disabled={busy} onClick={() => undo.mutate(ids)}>
          Undo
        </button>
      )}
      {(reject.error || undo.error) && <span className="text-xs text-rose-600">{(reject.error ?? undo.error)!.message}</span>}
    </div>
  );
}

function RejectedNote({ ids }: { ids: number[] }) {
  const { data: therapists = [] } = useTherapists();
  if (ids.length === 0) return null;
  const names = ids.map((id) => therapists.find((t) => t.id === id)?.name ?? `#${id}`);
  return <p className="mt-1 text-slate-500">Rejected for this session: {names.join(", ")}</p>;
}

function CandidateSelect({ a, onDone }: { a: PlanAssignment; onDone: () => void }) {
  const { data = [], isLoading } = useCandidates(a.planId, a.id, true);
  const edit = useEditAssignment();
  const [value, setValue] = useState(a.toTherapistId === null ? "cancel" : String(a.toTherapistId));

  const save = () =>
    edit.mutate(
      { planId: a.planId, assignmentId: a.id, toTherapistId: value === "cancel" ? null : Number(value) },
      { onSuccess: onDone },
    );

  if (isLoading) return <span className="text-xs text-slate-500">Loading options…</span>;
  const available = data.filter((c) => c.available);
  const unavailable = data.filter((c) => !c.available);
  return (
    <div className="flex flex-wrap items-center gap-1">
      <select className={inputClass} value={value} onChange={(e) => setValue(e.target.value)} aria-label="Replacement therapist">
        <optgroup label="Available (best first)">
          {available.map((c) => (
            <option key={c.therapistId} value={c.therapistId}>
              {c.therapistName} ({c.rank}) · {STEP_LABEL[c.step]}
              {c.distanceKm !== null ? ` · ${c.distanceKm} km` : ""}
              {c.rejected ? " · rejected by you" : ""}
            </option>
          ))}
        </optgroup>
        <optgroup label="Not available (will fail validation)">
          {unavailable.map((c) => (
            <option key={c.therapistId} value={c.therapistId}>
              {c.therapistName} ({c.rank}) · {c.unavailableReason}
            </option>
          ))}
        </optgroup>
        <option value="cancel">Cancel the session</option>
      </select>
      <Button onClick={save} disabled={edit.isPending}>
        Save
      </Button>
      <Button variant="secondary" onClick={onDone}>
        Back
      </Button>
      {edit.error && <span className="text-xs text-rose-600">{edit.error.message}</span>}
    </div>
  );
}
