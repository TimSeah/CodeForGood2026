import { useState } from "react";
import type { AbsenceType, Slot } from "@/api/types";
import { Avatar, Badge, Button, Card, Field, inputClass, QueryState } from "@/components/ui";
import { Icon } from "@/components/icons";
import { useTherapists } from "@/features/reference/api";
import { useAbsences, useReportAbsence } from "./api";

const TYPE_LABEL: Record<string, string> = { annual: "Annual", medical: "Medical", urgent: "Urgent", other: "Other" };

/** Everyone away on `date` (from WhatsApp, or planned leave entered here). */
export function AbsencePanel({ date }: { date: string }) {
  const { data = [], isLoading, error } = useAbsences(date);
  const [adding, setAdding] = useState(false);
  // "off" = rostered-off part-timers; that's normal, not a disruption, so hide it here.
  const absences = data.filter((a) => a.type !== "off");

  return (
    <Card
      title="Who’s away"
      count={absences.length}
      actions={
        <Button variant="ghost" size="sm" onClick={() => setAdding((v) => !v)} aria-expanded={adding}>
          <Icon name={adding ? "x" : "plus"} />
          {adding ? "Close" : "Record planned leave"}
        </Button>
      }
    >
      <QueryState isLoading={isLoading} error={error} isEmpty={absences.length === 0} emptyText="Nobody is away." />
      <ul className="flex flex-wrap gap-2">
        {absences.map((a) => (
          <li key={a.id} className="flex items-center gap-2 rounded-full border border-line py-1.5 pr-2 pl-1.5">
            <Avatar name={a.therapistName} small />
            <span className="text-sm font-semibold">{a.therapistName}</span>
            <Badge tone={a.type === "medical" || a.type === "urgent" ? "danger" : "warning"}>{TYPE_LABEL[a.type] ?? a.type}</Badge>
            <Badge>{a.slot ?? "Full day"}</Badge>
            {a.botReportId !== null && (
              <span className="text-muted" title="Reported via WhatsApp" aria-label="Reported via WhatsApp" role="img">
                <Icon name="chat" size={16} />
              </span>
            )}
          </li>
        ))}
      </ul>
      <p className="mt-4 text-[13px] text-muted">Rostered-off part-timers aren’t shown — that’s normal, not a disruption.</p>
      {adding && (
        <div className="mt-4 border-t border-line-soft pt-4">
          <AbsenceForm date={date} />
        </div>
      )}
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
    <form onSubmit={submit} className="flex flex-wrap items-end gap-3">
      <Field label="Therapist" className="flex-[1_1_180px]">
        <select className={inputClass} value={therapistId} onChange={(e) => setTherapistId(e.target.value ? Number(e.target.value) : "")}>
          <option value="">Choose…</option>
          {therapists.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name} ({t.rank})
            </option>
          ))}
        </select>
      </Field>
      <Field label="When">
        <select className={inputClass} value={slot} onChange={(e) => setSlot(e.target.value as Slot | "")}>
          <option value="">Full day</option>
          <option value="AM">AM</option>
          <option value="PM">PM</option>
        </select>
      </Field>
      <Field label="Type">
        <select className={inputClass} value={type} onChange={(e) => setType(e.target.value as AbsenceType)}>
          <option value="annual">Annual</option>
          <option value="medical">Medical</option>
          <option value="urgent">Urgent</option>
          <option value="other">Other</option>
        </select>
      </Field>
      <Button type="submit" disabled={therapistId === "" || report.isPending}>
        Record leave
      </Button>
      {report.error && <span className="w-full text-sm font-semibold text-bad">{report.error.message}</span>}
    </form>
  );
}
