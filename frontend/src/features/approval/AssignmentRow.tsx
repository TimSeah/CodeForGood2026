import { useState } from "react";
import type { PlanAssignment, ValidationIssue } from "@/api/types";
import { Badge, Button, inputClass } from "@/components/ui";
import { formatTime, STEP_LABEL, STEP_TONE } from "@/lib/format";
import { useCandidates, useEditAssignment } from "./api";

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
      </td>
    </tr>
  );
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
