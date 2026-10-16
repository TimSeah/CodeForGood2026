import { useState } from "react";
import type { BotDayPart, BotRole } from "@/api/types";
import { Button, Field, inputClass, Tabs } from "@/components/ui";
import { useStudents, useTherapists } from "@/features/reference/api";
import { useAddReport } from "./api";

/** Same data the WhatsApp bot collects, entered by the admin (phone calls, or demoing without the bot). */
export function AddReportForm({ date }: { date: string }) {
  const { data: therapists = [] } = useTherapists();
  const { data: students = [] } = useStudents();
  const add = useAddReport();
  const [role, setRole] = useState<BotRole>("therapist");
  const [name, setName] = useState("");
  const [endDate, setEndDate] = useState(date);
  const [dayPart, setDayPart] = useState<BotDayPart>("whole day");
  const [mc, setMc] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;
    add.mutate(
      { role, name, startDate: date, endDate: endDate < date ? date : endDate, dayPart, mcAttached: mc },
      { onSuccess: () => setName("") },
    );
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-1.5 text-[13px] font-semibold text-ink-soft">
          <span id="who-label">Who’s away</span>
          <Tabs
            label="Who’s away"
            value={role}
            onChange={(v) => (setRole(v), setName(""))}
            tabs={[
              { value: "therapist", label: "Therapist" },
              { value: "patient", label: "Child" },
            ]}
          />
        </div>
        <Field label="Name" className="flex-[1_1_180px]">
          <select className={inputClass} value={name} onChange={(e) => setName(e.target.value)}>
            <option value="">Choose {role === "therapist" ? "a therapist" : "a child"}…</option>
            {(role === "therapist" ? therapists : students).map((p) => (
              <option key={p.id} value={p.name}>
                {p.name}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <div className="flex flex-wrap items-end gap-4">
        <Field label="Until">
          <input type="date" className={inputClass} value={endDate} min={date} onChange={(e) => setEndDate(e.target.value)} />
        </Field>
        <div className="flex flex-col gap-1.5 text-[13px] font-semibold text-ink-soft">
          <span>Part of day</span>
          <Tabs
            label="Part of day"
            value={dayPart}
            onChange={setDayPart}
            tabs={[
              { value: "whole day", label: "Full day" },
              { value: "morning", label: "Morning" },
              { value: "afternoon", label: "Afternoon" },
            ]}
          />
        </div>
        <label className="flex min-h-10 items-center gap-2 text-sm font-semibold">
          <input type="checkbox" className="size-[18px] accent-brand" checked={mc} onChange={(e) => setMc(e.target.checked)} /> MC attached
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={!name || add.isPending}>
          Add report
        </Button>
        {add.error && <span className="text-sm font-semibold text-bad">{add.error.message}</span>}
      </div>
    </form>
  );
}
