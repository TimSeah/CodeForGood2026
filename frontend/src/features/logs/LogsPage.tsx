import { useState } from "react";
import type { SessionLog } from "@/api/types";
import { Badge, Button, Card, DateInput, inputClass, Modal, QueryState } from "@/components/ui";
import { useStudents, useTherapists } from "@/features/reference/api";
import { useSessions } from "@/features/schedule/api";
import { useSelectedDate } from "@/hooks/useSelectedDate";
import { formatCaseDate, formatTime } from "@/lib/format";
import { type LogFilter, logPdfUrl, useDeleteLog, useSessionLogs } from "./api";
import { LogForm } from "./LogForm";

/**
 * Therapist portal: take attendance and log what happened in each session. Logs show who actually took which
 * child, which the engine uses ("has covered this child before") and which is sent to substitutes as a PDF.
 */
export function LogsPage() {
  const [date, setDate] = useSelectedDate();
  const { data: therapists = [] } = useTherapists();
  const [therapistId, setTherapistId] = useState<number | "">("");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">Session logs</h1>
        <div className="flex items-center gap-2">
          <select
            className={inputClass}
            value={therapistId}
            onChange={(e) => setTherapistId(e.target.value ? Number(e.target.value) : "")}
            aria-label="I am"
          >
            <option value="">I am… (therapist)</option>
            {therapists.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <DateInput value={date} onChange={setDate} />
        </div>
      </div>
      {therapistId !== "" && <MySessions date={date} therapistId={therapistId} />}
      <LogTable date={date} therapistId={therapistId} />
    </div>
  );
}

/** The selected therapist's sessions on `date`, each with a quick "log it" action. */
function MySessions({ date, therapistId }: { date: string; therapistId: number }) {
  const { data: sessions = [], isLoading, error } = useSessions(date);
  const { data: logs = [] } = useSessionLogs({ date, therapistId });
  const [open, setOpen] = useState<number | null>(null);
  const mine = sessions.filter((s) => s.therapistId === therapistId);

  return (
    <Card title={`My sessions — ${formatCaseDate(date)}`}>
      <QueryState isLoading={isLoading} error={error} isEmpty={mine.length === 0} emptyText="No sessions scheduled for you today." />
      <ul className="divide-y divide-slate-100">
        {mine.map((s) => {
          const log = logs.find((l) => l.sessionId === s.id);
          return (
            <li key={s.id} className="py-2 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  <Badge>{s.slot}</Badge> {formatTime(s.startTime)}–{formatTime(s.endTime)} · <strong>{s.studentName}</strong> ·{" "}
                  <span className="capitalize">{s.location}</span>
                  {s.originalTherapistId !== null && s.originalTherapistId !== therapistId && (
                    <span className="ml-1">
                      <Badge tone="info">covering</Badge>
                    </span>
                  )}
                  {s.status === "cancelled" && (
                    <span className="ml-1">
                      <Badge tone="danger">cancelled</Badge>
                    </span>
                  )}
                </span>
                {log ? (
                  <Badge tone="success">Logged · {log.attendance}</Badge>
                ) : (
                  <Button variant="secondary" onClick={() => setOpen(open === s.id ? null : s.id)}>
                    {open === s.id ? "Close" : "Log session"}
                  </Button>
                )}
              </div>
              {open === s.id && (
                <div className="mt-3 rounded-md border border-slate-200 p-3">
                  <LogForm
                    preset={{ sessionId: s.id, date, slot: s.slot, studentId: s.studentId, therapistId }}
                    onDone={() => setOpen(null)}
                  />
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

/** All logs with filters, plus edit / delete / PDF. */
function LogTable({ date, therapistId }: { date: string; therapistId: number | "" }) {
  const { data: students = [] } = useStudents();
  const [scope, setScope] = useState<"day" | "all">("day");
  const [studentId, setStudentId] = useState<number | "">("");
  const [editing, setEditing] = useState<SessionLog | null>(null);
  const [adding, setAdding] = useState(false);
  const del = useDeleteLog();

  const filter: LogFilter = {
    date: scope === "day" ? date : undefined,
    therapistId: therapistId === "" ? undefined : therapistId,
    studentId: studentId === "" ? undefined : studentId,
  };
  const { data = [], isLoading, error } = useSessionLogs(filter);
  const teams = new Map(students.map((s) => [s.id, new Set(s.teamTherapistIds)]));

  return (
    <Card
      title="Logs"
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <select className={inputClass} value={scope} onChange={(e) => setScope(e.target.value as "day" | "all")} aria-label="Dates">
            <option value="day">This date</option>
            <option value="all">All dates</option>
          </select>
          <select
            className={inputClass}
            value={studentId}
            onChange={(e) => setStudentId(e.target.value ? Number(e.target.value) : "")}
            aria-label="Child"
          >
            <option value="">All children</option>
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <Button variant="secondary" onClick={() => setAdding(true)}>
            + New log
          </Button>
        </div>
      }
    >
      <QueryState isLoading={isLoading} error={error} isEmpty={data.length === 0} emptyText="No logs match these filters." />
      {data.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="text-xs text-slate-500">
              <tr>
                <th className="py-2">Date</th>
                <th>Child</th>
                <th>Therapist</th>
                <th>Attendance</th>
                <th>Summary</th>
                <th />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.map((l) => (
                <tr key={l.id} className="align-top">
                  <td className="py-2 whitespace-nowrap">
                    {formatCaseDate(l.date)} <Badge>{l.slot}</Badge>
                  </td>
                  <td>{l.studentName}</td>
                  <td>
                    {l.therapistName}
                    {teams.size > 0 && !teams.get(l.studentId)?.has(l.therapistId) && (
                      <span className="ml-1">
                        <Badge tone="info">cover</Badge>
                      </span>
                    )}
                  </td>
                  <td className="capitalize">{l.attendance}</td>
                  <td className="max-w-md text-slate-600">{l.summary ?? "—"}</td>
                  <td className="whitespace-nowrap text-right text-xs">
                    <a className="text-sky-700 underline" href={logPdfUrl(l.id)} target="_blank" rel="noreferrer">
                      PDF
                    </a>{" "}
                    <button className="ml-2 text-sky-700 underline" onClick={() => setEditing(l)}>
                      Edit
                    </button>
                    <button
                      className="ml-2 text-rose-700 underline"
                      onClick={() => window.confirm(`Delete the log for ${l.studentName} on ${l.date}?`) && del.mutate(l.id)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {editing && (
        <Modal title={`Edit log — ${editing.studentName}, ${editing.date} ${editing.slot}`} onClose={() => setEditing(null)}>
          <LogForm existing={editing} onDone={() => setEditing(null)} />
        </Modal>
      )}
      {adding && (
        <Modal title="New session log" onClose={() => setAdding(false)}>
          <LogForm onDone={() => setAdding(false)} />
        </Modal>
      )}
    </Card>
  );
}
