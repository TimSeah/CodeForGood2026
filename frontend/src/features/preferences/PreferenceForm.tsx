import { useState } from "react";
import type { PreferenceType, SchedulingPreference } from "@/api/types";
import { Button, Field, inputClass, Tabs } from "@/components/ui";
import type { PreferenceInput } from "./api";

const DAYS = [
  { d: 1, label: "Mon" },
  { d: 2, label: "Tue" },
  { d: 3, label: "Wed" },
  { d: 4, label: "Thu" },
  { d: 5, label: "Fri" },
  { d: 6, label: "Sat" },
  { d: 0, label: "Sun" },
];

/**
 * The admin's final say on a rule: strength, and for time rules the exact time, whether it applies to the
 * session's START or END, the days, and whether it's ongoing. Nothing is inferred silently.
 */
export function PreferenceForm({
  type,
  initial,
  submitLabel,
  pending,
  error,
  onSubmit,
  onCancel,
}: {
  type: PreferenceType;
  initial?: Partial<SchedulingPreference>;
  submitLabel: string;
  pending: boolean;
  error: Error | null;
  onSubmit: (input: PreferenceInput) => void;
  onCancel: () => void;
}) {
  const [strength, setStrength] = useState<"soft" | "hard">(initial?.strength ?? (type === "pairing" ? "soft" : "hard"));
  const [days, setDays] = useState<number[]>(initial?.days ?? []);
  const [boundaryTime, setBoundaryTime] = useState(initial?.boundaryTime ?? "");
  const [appliesTo, setAppliesTo] = useState<"start" | "end" | "">(initial?.appliesTo ?? "");
  const [ongoing, setOngoing] = useState(initial?.effectiveTo ? false : true);
  const [effectiveFrom, setEffectiveFrom] = useState(initial?.effectiveFrom ?? "");
  const [effectiveTo, setEffectiveTo] = useState(initial?.effectiveTo ?? "");
  const [reason, setReason] = useState(initial?.reason ?? "");

  const isTime = type === "time_unavailable";
  const missing = isTime
    ? [!days.length && "days", !boundaryTime && "time", !appliesTo && "start or end", !ongoing && !effectiveTo && "end date"].filter(Boolean)
    : [];

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (missing.length) return;
    onSubmit({
      strength,
      days: isTime ? days : null,
      boundaryTime: isTime ? boundaryTime : null,
      appliesTo: isTime ? (appliesTo as "start" | "end") : null,
      ongoing,
      effectiveFrom: effectiveFrom || null,
      effectiveTo: ongoing ? null : effectiveTo || null,
      reason: reason.trim() || null,
    });
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5 text-[13px] font-semibold text-ink-soft">
        <span>How strict?</span>
        <Tabs
          label="How strict"
          value={strength}
          onChange={setStrength}
          tabs={[
            { value: "soft", label: isTime ? "Avoid if possible" : "Avoid when someone else suitable is free" },
            { value: "hard", label: isTime ? "Never (unavailable)" : "Never assign" },
          ]}
        />
        <span className="font-normal text-muted">
          {strength === "hard"
            ? "Hard: the engine won't propose it, and assigning it by hand is a validation error."
            : "Soft: used only if no other suitable therapist is free — never at the cost of cancelling a session."}
        </span>
      </div>

      {isTime && (
        <>
          <fieldset className="flex flex-col gap-1.5">
            <legend className="mb-1.5 text-[13px] font-semibold text-ink-soft">Which days?</legend>
            <div className="flex flex-wrap gap-1.5">
              {DAYS.map(({ d, label }) => (
                <label key={d} className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-field px-2.5 py-1.5 text-sm has-checked:border-brand has-checked:bg-brand-soft">
                  <input
                    type="checkbox"
                    className="size-4 accent-brand"
                    checked={days.includes(d)}
                    onChange={(e) => setDays((v) => (e.target.checked ? [...v, d] : v.filter((x) => x !== d)))}
                  />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="flex flex-wrap items-end gap-4">
            <Field label="Cut-off time" hint="Singapore time">
              <input type="time" required className={inputClass} value={boundaryTime} onChange={(e) => setBoundaryTime(e.target.value)} />
            </Field>
            <fieldset className="flex flex-col gap-1.5">
              <legend className="mb-1.5 text-[13px] font-semibold text-ink-soft">The cut-off applies to the session’s…</legend>
              <div className="flex flex-col gap-1 text-sm">
                <label className="flex items-center gap-2">
                  <input type="radio" name="appliesTo" className="size-4 accent-brand" checked={appliesTo === "end"} onChange={() => setAppliesTo("end")} />
                  END — no sessions still running after this time
                </label>
                <label className="flex items-center gap-2">
                  <input type="radio" name="appliesTo" className="size-4 accent-brand" checked={appliesTo === "start"} onChange={() => setAppliesTo("start")} />
                  START — no sessions starting at or after this time
                </label>
              </div>
            </fieldset>
          </div>
          <p className="text-xs text-muted">
            Checked against each session’s actual times (e.g. 2:00–5:30 pm), not just “AM / PM”.
          </p>
        </>
      )}

      <div className="flex flex-wrap items-end gap-4">
        <label className="flex min-h-10 items-center gap-2 text-sm font-semibold">
          <input type="checkbox" className="size-[18px] accent-brand" checked={ongoing} onChange={(e) => setOngoing(e.target.checked)} />
          Ongoing (no end date)
        </label>
        <Field label="From" hint="optional">
          <input type="date" className={inputClass} value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} />
        </Field>
        {!ongoing && (
          <Field label="Until">
            <input type="date" required className={inputClass} value={effectiveTo} min={effectiveFrom || undefined} onChange={(e) => setEffectiveTo(e.target.value)} />
          </Field>
        )}
      </div>

      <Field label="Reason" hint="kept with the rule">
        <input className={inputClass} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Parent request, therapist's school pickup" />
      </Field>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" disabled={pending || missing.length > 0}>
          {pending ? "Saving…" : submitLabel}
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        {missing.length > 0 && <span className="text-sm text-muted">Still needed: {missing.join(", ")}</span>}
        {error && <span className="text-sm font-semibold text-bad">{error.message}</span>}
      </div>
    </form>
  );
}
