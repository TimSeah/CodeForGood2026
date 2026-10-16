import { useState } from "react";
import type { BotDayPart, BotRole } from "@/api/types";
import { Button, inputClass } from "@/components/ui";
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
    <form onSubmit={submit} className="flex flex-wrap items-center gap-2 text-sm">
      <select className={inputClass} value={role} onChange={(e) => (setRole(e.target.value as BotRole), setName(""))} aria-label="Who">
        <option value="therapist">Therapist</option>
        <option value="patient">Child</option>
      </select>
      <select className={inputClass} value={name} onChange={(e) => setName(e.target.value)} aria-label="Name">
        <option value="">Name…</option>
        {(role === "therapist" ? therapists : students).map((p) => (
          <option key={p.id} value={p.name}>
            {p.name}
          </option>
        ))}
      </select>
      <label className="flex items-center gap-1">
        until
        <input type="date" className={inputClass} value={endDate} min={date} onChange={(e) => setEndDate(e.target.value)} />
      </label>
      <select className={inputClass} value={dayPart} onChange={(e) => setDayPart(e.target.value as BotDayPart)} aria-label="Day part">
        <option value="whole day">Full day</option>
        <option value="morning">Morning</option>
        <option value="afternoon">Afternoon</option>
      </select>
      <label className="flex items-center gap-1">
        <input type="checkbox" checked={mc} onChange={(e) => setMc(e.target.checked)} /> MC
      </label>
      <Button type="submit" disabled={!name || add.isPending}>
        Add report
      </Button>
      {add.error && <span className="text-rose-600">{add.error.message}</span>}
    </form>
  );
}
