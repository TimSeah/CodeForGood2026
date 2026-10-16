import { useState } from "react";
import type { AbsenceType, Slot } from "@/api/types";
import { Badge, Button, Card, inputClass, QueryState } from "@/components/ui";
import { useTherapists } from "@/features/reference/api";
import { useAbsences, useReportAbsence } from "./api";

/** Everyone away on `date` (from WhatsApp, or planned leave entered here). */
export function AbsencePanel({ date }: { date: string }) {
  const { data = [], isLoading, error } = useAbsences(date);
  // "off" = rostered-off part-timers; that's normal, not a disruption, so hide it here.
  const absences = data.filter((a) => a.type !== "off");

  return (
    <Card title={`Therapists away (${absences.length})`}>
      <QueryState isLoading={isLoading} error={error} isEmpty={absences.length === 0} emptyText="Nobody is away." />
      <ul className="flex flex-wrap gap-2 text-sm">
        {absences.map((a) => (
          <li key={a.id} className="flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1">
            <span>{a.therapistName}</span>
            <Badge tone={a.type === "medical" || a.type === "urgent" ? "danger" : "warning"}>{a.type}</Badge>
            <Badge>{a.slot ?? "Full day"}</Badge>
            {a.botReportId !== null && <span title="Reported via WhatsApp" aria-label="Reported via WhatsApp">💬</span>}
          </li>
        ))}
      </ul>
      <details className="mt-4">
        <summary className="cursor-pointer text-sm text-slate-600">Record planned leave</summary>
        <div className="mt-2">
          <AbsenceForm date={date} />
        </div>
      </details>
    </Card>
  );
}

function AbsenceForm({ date }: { date: string }) {
  const { data: therapists = [] } = useTherapists();
  const report = useReportAbsence();
  const [therapistId, setTherapistId] = useState<number | "">("");
  const [slot, setSlot] = useState<Slot | "">("");
  const [type, setType] = useState<AbsenceType>("annual");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (therapistId === "") return;
    report.mutate({ therapistId, date, slot: slot || null, type }, { onSuccess: () => setTherapistId("") });
  };

  return (
    <form onSubmit={submit} className="flex flex-wrap items-center gap-2">
      <select className={inputClass} value={therapistId} onChange={(e) => setTherapistId(e.target.value ? Number(e.target.value) : "")} aria-label="Therapist">
        <option value="">Therapist…</option>
        {therapists.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name} ({t.rank})
          </option>
        ))}
      </select>
      <select className={inputClass} value={slot} onChange={(e) => setSlot(e.target.value as Slot | "")} aria-label="Slot">
        <option value="">Full day</option>
        <option value="AM">AM</option>
        <option value="PM">PM</option>
      </select>
      <select className={inputClass} value={type} onChange={(e) => setType(e.target.value as AbsenceType)} aria-label="Type">
        <option value="annual">Annual</option>
        <option value="medical">Medical</option>
        <option value="urgent">Urgent</option>
        <option value="other">Other</option>
      </select>
      <Button type="submit" disabled={therapistId === "" || report.isPending}>
        Record
      </Button>
      {report.error && <span className="text-sm text-rose-600">{report.error.message}</span>}
    </form>
  );
}
