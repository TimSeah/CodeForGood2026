import { useMemo, useState } from "react";
import type { Plan, Session } from "@/api/types";
import { type CalendarEntry, MonthCalendar } from "@/components/MonthCalendar";
import { Card, inputClass, QueryState } from "@/components/ui";
import { formatTime } from "@/lib/format";
import { type Person, usePersonMonth } from "@/features/schedule/api";

/**
 * The tentative calendar for one therapist or child, like their sheet in the Excel schedules,
 * with the plan's changes for `plan.date` overlaid.
 */
export function CalendarPreview({ plan }: { plan: Plan }) {
  const month = plan.date.slice(0, 7);
  const people = useMemo(() => peopleIn(plan), [plan]);
  const [key, setKey] = useState(() => (people[0] ? `${people[0].kind}:${people[0].id}` : ""));
  const person: Person | null = key ? { kind: key.split(":")[0] as Person["kind"], id: Number(key.split(":")[1]) } : null;
  const { data = [], isLoading, error } = usePersonMonth(month, person);
  const entries = person ? buildEntries(data, plan, person) : new Map<string, CalendarEntry[]>();

  return (
    <Card
      title="Tentative calendars"
      actions={
        <select className={inputClass} value={key} onChange={(e) => setKey(e.target.value)} aria-label="Whose calendar">
          {(["therapist", "student"] as const).map((kind) => (
            <optgroup key={kind} label={kind === "therapist" ? "Therapists affected" : "Children affected"}>
              {people
                .filter((p) => p.kind === kind)
                .map((p) => (
                  <option key={`${p.kind}:${p.id}`} value={`${p.kind}:${p.id}`}>
                    {p.name}
                  </option>
                ))}
            </optgroup>
          ))}
        </select>
      }
    >
      <QueryState isLoading={isLoading} error={error} />
      {person && !isLoading && <MonthCalendar month={month} entriesByDate={entries} highlightDate={plan.date} />}
      <p className="mt-2 text-xs text-slate-500">
        Blue = new under this plan · struck through = moved away · red = cancelled. This is the calendar each person will get.
      </p>
    </Card>
  );
}

function peopleIn(plan: Plan): (Person & { name: string })[] {
  const seen = new Map<string, Person & { name: string }>();
  for (const a of plan.assignments) {
    seen.set(`student:${a.studentId}`, { kind: "student", id: a.studentId, name: a.studentName });
    if (a.toTherapistId !== null) seen.set(`therapist:${a.toTherapistId}`, { kind: "therapist", id: a.toTherapistId, name: a.toTherapistName! });
    if (a.fromTherapistId !== null) {
      seen.set(`therapist:${a.fromTherapistId}`, { kind: "therapist", id: a.fromTherapistId, name: a.fromTherapistName! });
    }
  }
  return [...seen.values()].sort((x, y) => x.name.localeCompare(y.name));
}

function buildEntries(sessions: Session[], plan: Plan, person: Person): Map<string, CalendarEntry[]> {
  const byDate = new Map<string, CalendarEntry[]>();
  const add = (date: string, e: CalendarEntry) => byDate.set(date, [...(byDate.get(date) ?? []), e]);
  const changes = new Map(plan.assignments.map((a) => [a.sessionId, a]));
  const time = (s: { startTime: string; endTime: string }) => `${formatTime(s.startTime)}–${formatTime(s.endTime)}`;
  const pending = plan.status === "draft";

  for (const s of sessions) {
    const change = pending ? changes.get(s.id) : undefined;
    const other = person.kind === "therapist" ? s.studentName : (s.therapistName ?? change?.fromTherapistName ?? "needs cover");
    if (s.status === "cancelled" || (change && change.toTherapistId === null)) {
      add(s.date, { key: s.id, tone: "cancelled", content: `${time(s)} ${other} (cancelled)` });
    } else if (change && person.kind === "student") {
      add(s.date, { key: s.id, tone: "changed", content: `${time(s)} ${change.toTherapistName} (was ${change.fromTherapistName})` });
    } else if (change && change.toTherapistId !== person.id) {
      add(s.date, { key: s.id, tone: "removed", content: `${time(s)} ${other} → ${change.toTherapistName}` });
    } else {
      add(s.date, { key: s.id, content: `${time(s)} ${other}${s.location !== "clinic" ? ` (${s.location})` : ""}` });
    }
  }
  // New sessions this therapist picks up under the plan.
  if (pending && person.kind === "therapist") {
    for (const a of plan.assignments) {
      if (a.toTherapistId === person.id && !sessions.some((s) => s.id === a.sessionId)) {
        add(plan.date, { key: `new-${a.id}`, tone: "changed", content: `${time(a)} ${a.studentName} (cover)` });
      }
    }
  }
  return byDate;
}
