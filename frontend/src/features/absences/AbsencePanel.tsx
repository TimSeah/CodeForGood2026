import { useState } from "react";
import type { AbsenceType, Slot } from "@/api/types";
import { Badge, Button, Card, QueryState } from "@/components/ui";
import { useTherapists } from "@/features/reference/api";
import { useAbsences, useReportAbsence } from "./api";

/** Lists who is away on `date` and lets the admin report a new absence. */
export function AbsencePanel({ date }: { date: string }) {
  const { data = [], isLoading, error } = useAbsences(date);
  // "off" = rostered-off part-timers; that's normal, not a disruption, so hide it here.
  const absences = data.filter((a) => a.type !== "off");

  return (
    <Card title="Absences">
      <AbsenceForm date={date} />
      <div className="mt-4">
        <QueryState isLoading={isLoading} error={error} isEmpty={absences.length === 0} emptyText="No absences reported." />
        <ul className="divide-y divide-slate-100 text-sm">
          {absences.map((a) => (
            <li key={a.id} className="flex items-center justify-between py-2">
              <span>{a.therapistName}</span>
              <span className="flex gap-1">
                <Badge tone={a.type === "medical" || a.type === "urgent" ? "danger" : "warning"}>{a.type}</Badge>
                <Badge>{a.slot ?? "Full day"}</Badge>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}

function AbsenceForm({ date }: { date: string }) {
  const { data: therapists = [] } = useTherapists();
  const report = useReportAbsence();
  const [therapistId, setTherapistId] = useState<number | "">("");
  const [slot, setSlot] = useState<Slot | "">("");
  const [type, setType] = useState<AbsenceType>("medical");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (therapistId === "") return;
    report.mutate(
      { therapistId, date, slot: slot || null, type },
      { onSuccess: () => setTherapistId("") },
    );
  };

  const select = "rounded-md border border-slate-300 px-2 py-1 text-sm";
  return (
    <form onSubmit={submit} className="flex flex-wrap items-center gap-2">
      <select className={select} value={therapistId} onChange={(e) => setTherapistId(e.target.value ? Number(e.target.value) : "")}>
        <option value="">Therapist…</option>
        {therapists.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name} ({t.rank})
          </option>
        ))}
      </select>
      <select className={select} value={slot} onChange={(e) => setSlot(e.target.value as Slot | "")}>
        <option value="">Full day</option>
        <option value="AM">AM</option>
        <option value="PM">PM</option>
      </select>
      <select className={select} value={type} onChange={(e) => setType(e.target.value as AbsenceType)}>
        <option value="medical">Medical</option>
        <option value="annual">Annual</option>
        <option value="urgent">Urgent</option>
        <option value="other">Other</option>
      </select>
      <Button type="submit" disabled={therapistId === "" || report.isPending}>
        Report
      </Button>
      {report.error && <span className="text-sm text-rose-600">{report.error.message}</span>}
    </form>
  );
}
