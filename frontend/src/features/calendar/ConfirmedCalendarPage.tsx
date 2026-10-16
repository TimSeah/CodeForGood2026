import { useMemo, useState } from "react";
import type { Session } from "@/api/types";
import { type CalendarEntry, MonthCalendar } from "@/components/MonthCalendar";
import { Badge, Card, DateInput, PageHeader, QueryState, inputClass } from "@/components/ui";
import { useSelectedDate } from "@/hooks/useSelectedDate";
import { formatCaseDate, formatTime } from "@/lib/format";
import { useConfirmedSessions } from "./api";

type Filter = "all" | `therapist:${number}` | `student:${number}`;

/** Centre-wide calendar containing only appointments that are ready to proceed. */
export function ConfirmedCalendarPage() {
  const [date, setDate] = useSelectedDate();
  const month = date.slice(0, 7);
  const [filter, setFilter] = useState<Filter>("all");
  const [expandedDates, setExpandedDates] = useState<Set<string>>(() => new Set());
  const { data = [], isLoading, error } = useConfirmedSessions(month);

  const people = useMemo(() => getPeople(data), [data]);
  const visible = useMemo(() => filterSessions(data, filter), [data, filter]);
  const entries = useMemo(
    () => buildEntries(visible, expandedDates, (entryDate) => {
      setExpandedDates((current) => {
        const next = new Set(current);
        if (next.has(entryDate)) next.delete(entryDate);
        else next.add(entryDate);
        return next;
      });
    }),
    [visible, expandedDates],
  );
  const selected = visible.filter((session) => session.date === date);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Ready to proceed"
        title="Confirmed calendar"
        actions={<DateInput value={date} onChange={setDate} />}
      />

      <Card
        title="Confirmed appointments"
        subtitle="Standing appointments and accepted cover changes. Pending replies, absences and cancellations are hidden."
        actions={
          <select
            className={inputClass}
            value={filter}
            onChange={(event) => setFilter(event.target.value as Filter)}
            aria-label="Filter calendar by therapist or child"
          >
            <option value="all">Everyone</option>
            <optgroup label="Therapists">
              {people.therapists.map((person) => (
                <option key={`therapist:${person.id}`} value={`therapist:${person.id}`}>
                  {person.name}
                </option>
              ))}
            </optgroup>
            <optgroup label="Children">
              {people.students.map((person) => (
                <option key={`student:${person.id}`} value={`student:${person.id}`}>
                  {person.name}
                </option>
              ))}
            </optgroup>
          </select>
        }
      >
        <QueryState
          isLoading={isLoading}
          error={error}
          isEmpty={!isLoading && !error && visible.length === 0}
          emptyText="No confirmed appointments for this month."
        />
        {!isLoading && !error && visible.length > 0 && (
          <MonthCalendar month={month} entriesByDate={entries} highlightDate={date} />
        )}
      </Card>

      {!isLoading && !error && (
        <Card title={`Confirmed on ${formatCaseDate(date)}`} count={selected.length} flush>
          {selected.length === 0 ? (
            <p className="px-5 py-4 text-sm text-muted">No confirmed appointments on this date.</p>
          ) : (
            <ul>
              {selected.map((session) => (
                <li
                  key={session.id}
                  className="grid gap-2 border-t border-line-soft px-5 py-3 first:border-t-0 sm:grid-cols-[130px_minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-center"
                >
                  <div className="text-sm font-bold text-ink-soft">
                    {formatTime(session.startTime)}–{formatTime(session.endTime)}
                  </div>
                  <div className="font-bold">{session.studentName}</div>
                  <div className="text-sm font-semibold text-muted">{session.therapistName}</div>
                  <div className="flex flex-wrap gap-1.5 sm:justify-end">
                    <Badge><span className="capitalize">{session.location}</span></Badge>
                    {session.originalTherapistId !== null && <Badge tone="info">Accepted cover</Badge>}
                    <Badge tone="success">Confirmed</Badge>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
    </div>
  );
}

function getPeople(sessions: Session[]) {
  const therapists = new Map<number, string>();
  const students = new Map<number, string>();
  for (const session of sessions) {
    if (session.therapistId !== null && session.therapistName) therapists.set(session.therapistId, session.therapistName);
    students.set(session.studentId, session.studentName);
  }
  const sorted = (values: Map<number, string>) =>
    [...values].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  return { therapists: sorted(therapists), students: sorted(students) };
}

function filterSessions(sessions: Session[], filter: Filter) {
  if (filter === "all") return sessions;
  const [kind, rawId] = filter.split(":");
  const id = Number(rawId);
  return sessions.filter((session) => (kind === "therapist" ? session.therapistId === id : session.studentId === id));
}

const COLLAPSED_APPOINTMENTS = 3;

function buildEntries(sessions: Session[], expandedDates: Set<string>, toggleDate: (date: string) => void) {
  const entries = new Map<string, CalendarEntry[]>();
  for (const session of sessions) {
    const entry: CalendarEntry = {
      key: session.id,
      tone: session.originalTherapistId !== null ? "changed" : "normal",
      content: (
        <span title={`${session.studentName} with ${session.therapistName}`}>
          {formatTime(session.startTime)} {session.studentName} · {session.therapistName}
        </span>
      ),
    };
    entries.set(session.date, [...(entries.get(session.date) ?? []), entry]);
  }

  for (const [entryDate, dayEntries] of entries) {
    if (dayEntries.length <= COLLAPSED_APPOINTMENTS) continue;
    const expanded = expandedDates.has(entryDate);
    const hidden = dayEntries.length - COLLAPSED_APPOINTMENTS;
    const toggle: CalendarEntry = {
      key: `toggle-${entryDate}`,
      content: (
        <button
          type="button"
          className="w-full cursor-pointer text-left font-bold text-brand hover:underline"
          aria-expanded={expanded}
          onClick={() => toggleDate(entryDate)}
        >
          {expanded ? "Show less" : `… ${hidden} more`}
        </button>
      ),
    };
    entries.set(entryDate, expanded ? [...dayEntries, toggle] : [...dayEntries.slice(0, COLLAPSED_APPOINTMENTS), toggle]);
  }
  return entries;
}
