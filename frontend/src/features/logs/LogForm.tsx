import { useState } from "react";
import type { Attendance, SessionLog, Slot } from "@/api/types";
import { Button, Field, inputClass } from "@/components/ui";
import { useStudents, useTherapists } from "@/features/reference/api";
import { type SessionLogInput, useCreateLog, useUpdateLog } from "./api";

const ATTENDANCE: Attendance[] = ["present", "late", "absent", "cancelled"];

/**
 * Create or edit a session log. `preset` fixes the session (from "my sessions today"); otherwise the
 * therapist/child/slot are chosen (e.g. an unscheduled cover).
 */
export function LogForm({
  existing,
  preset,
  onDone,
}: {
  existing?: SessionLog;
  preset?: Pick<SessionLogInput, "sessionId" | "date" | "slot" | "studentId" | "therapistId">;
  onDone: () => void;
}) {
  const { data: therapists = [] } = useTherapists();
  const { data: students = [] } = useStudents();
  const create = useCreateLog();
  const update = useUpdateLog();
  const base = existing ?? preset;
  const [form, setForm] = useState({
    date: base?.date ?? "",
    slot: (base?.slot ?? "AM") as Slot,
    studentId: base?.studentId ?? 0,
    therapistId: base?.therapistId ?? 0,
    attendance: existing?.attendance ?? ("present" as Attendance),
    summary: existing?.summary ?? "",
    goals: existing?.goals ?? "",
    notes: existing?.notes ?? "",
  });
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));
  const fixed = !!preset && !existing;
  const mutation = existing ? update : create;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const body = {
      ...form,
      sessionId: existing?.sessionId ?? preset?.sessionId ?? null,
      summary: form.summary || null,
      goals: form.goals || null,
      notes: form.notes || null,
    };
    if (existing) update.mutate({ id: existing.id, ...body }, { onSuccess: onDone });
    else create.mutate(body, { onSuccess: onDone });
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-4 text-sm">
      {!fixed && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Date">
            <input type="date" required className={inputClass} value={form.date} onChange={(e) => set("date", e.target.value)} />
          </Field>
          <Field label="Slot">
            <select className={inputClass} value={form.slot} onChange={(e) => set("slot", e.target.value as Slot)}>
              <option value="AM">AM</option>
              <option value="PM">PM</option>
            </select>
          </Field>
          <Field label="Therapist">
            <select required className={inputClass} value={form.therapistId || ""} onChange={(e) => set("therapistId", Number(e.target.value))}>
              <option value="">Choose…</option>
              {therapists.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Child">
            <select required className={inputClass} value={form.studentId || ""} onChange={(e) => set("studentId", Number(e.target.value))}>
              <option value="">Choose…</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
      )}
      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1.5 text-[13px] font-semibold text-ink-soft">Attendance</legend>
        <div className="inline-flex flex-wrap gap-0.5 self-start rounded-[10px] bg-sunk p-[3px]">
          {ATTENDANCE.map((a) => (
            <label
              key={a}
              className="flex min-h-[34px] cursor-pointer items-center rounded-lg px-3 text-[13px] font-semibold text-ink-soft capitalize has-checked:bg-white has-checked:text-ink has-checked:shadow-sm has-focus-visible:outline-2 has-focus-visible:outline-brand"
            >
              <input type="radio" name="attendance" className="sr-only" checked={form.attendance === a} onChange={() => set("attendance", a)} />
              {a}
            </label>
          ))}
        </div>
      </fieldset>
      <Field label="Summary" hint="shared with a substitute therapist if this child's next session is covered">
        <textarea className={`${inputClass} py-2.5`} rows={2} value={form.summary} onChange={(e) => set("summary", e.target.value)} />
      </Field>
      <Field label="Goals / programmes worked on">
        <input className={inputClass} value={form.goals} onChange={(e) => set("goals", e.target.value)} />
      </Field>
      <Field label="Notes" hint="clinical notes; included in the session PDF">
        <textarea className={`${inputClass} py-2.5`} rows={3} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
      </Field>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" disabled={mutation.isPending}>
          {existing ? "Save changes" : "Save log"}
        </Button>
        <Button type="button" variant="secondary" onClick={onDone}>
          Cancel
        </Button>
        {mutation.error && <span className="font-semibold text-bad">{mutation.error.message}</span>}
      </div>
    </form>
  );
}
