import { useState } from "react";
import type { Attendance, SessionLog, Slot } from "@/api/types";
import { Button, inputClass } from "@/components/ui";
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
    <form onSubmit={submit} className="space-y-3 text-sm">
      {!fixed && (
        <div className="flex flex-wrap gap-2">
          <input type="date" required className={inputClass} value={form.date} onChange={(e) => set("date", e.target.value)} aria-label="Date" />
          <select className={inputClass} value={form.slot} onChange={(e) => set("slot", e.target.value as Slot)} aria-label="Slot">
            <option value="AM">AM</option>
            <option value="PM">PM</option>
          </select>
          <select required className={inputClass} value={form.therapistId || ""} onChange={(e) => set("therapistId", Number(e.target.value))} aria-label="Therapist">
            <option value="">Therapist…</option>
            {therapists.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <select required className={inputClass} value={form.studentId || ""} onChange={(e) => set("studentId", Number(e.target.value))} aria-label="Child">
            <option value="">Child…</option>
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      )}
      <fieldset className="flex flex-wrap gap-3">
        <legend className="mb-1 font-medium">Attendance</legend>
        {ATTENDANCE.map((a) => (
          <label key={a} className="flex items-center gap-1 capitalize">
            <input type="radio" name="attendance" checked={form.attendance === a} onChange={() => set("attendance", a)} /> {a}
          </label>
        ))}
      </fieldset>
      <label className="block">
        <span className="font-medium">Summary</span>{" "}
        <span className="text-xs text-slate-500">— shared with a substitute therapist if this child's next session is covered</span>
        <textarea aria-label="Summary" className={`${inputClass} mt-1 w-full`} rows={2} value={form.summary} onChange={(e) => set("summary", e.target.value)} />
      </label>
      <label className="block">
        <span className="font-medium">Goals / programmes worked on</span>
        <input aria-label="Goals" className={`${inputClass} mt-1 w-full`} value={form.goals} onChange={(e) => set("goals", e.target.value)} />
      </label>
      <label className="block">
        <span className="font-medium">Notes</span> <span className="text-xs text-slate-500">— clinical notes; included in the session PDF</span>
        <textarea aria-label="Notes" className={`${inputClass} mt-1 w-full`} rows={3} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
      </label>
      <div className="flex items-center gap-2">
        <Button type="submit" disabled={mutation.isPending}>
          {existing ? "Save changes" : "Save log"}
        </Button>
        <Button type="button" variant="secondary" onClick={onDone}>
          Cancel
        </Button>
        {mutation.error && <span className="text-rose-600">{mutation.error.message}</span>}
      </div>
    </form>
  );
}
