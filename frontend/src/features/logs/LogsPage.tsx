import { useEffect, useState } from "react";
import type { Attendance, SessionLog } from "@/api/types";
import { Badge, Button, Card, DateInput, inputClass, LinkButton, Modal, PageHeader, QueryState, Tabs, type Tone } from "@/components/ui";
import { Icon } from "@/components/icons";
import { useStudents, useTherapists } from "@/features/reference/api";
import { useSessions } from "@/features/schedule/api";
import { useSelectedDate } from "@/hooks/useSelectedDate";
import { formatCaseDate, formatTime } from "@/lib/format";
import { type LogFilter, logPdfUrl, useDeleteLog, usePrepareVideoHandover, useSessionLogs } from "./api";
import { LogForm } from "./LogForm";
import { SessionVideoPanel } from "./SessionVideoPanel";

const ATTENDANCE_TONE: Record<Attendance, Tone> = { present: "success", late: "warning", absent: "danger", cancelled: "danger" };

/**
 * Therapist portal: take attendance and log what happened in each session. Logs show who actually took which
 * child, which the engine uses ("has covered this child before") and which is sent to substitutes as a PDF.
 */
export function LogsPage() {
  const [date, setDate] = useSelectedDate();
  const { data: therapists = [] } = useTherapists();
  const [therapistId, setTherapistId] = useState<number | "">("");

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Therapist portal"
        title="Session logs"
        actions={
          <>
            <label className="flex items-center gap-2 text-sm font-semibold text-ink-soft">
              I am
              <select className={inputClass} value={therapistId} onChange={(e) => setTherapistId(e.target.value ? Number(e.target.value) : "")}>
                <option value="">Choose a therapist…</option>
                {therapists.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
            <DateInput value={date} onChange={setDate} />
          </>
        }
      />
      {therapistId === "" ? (
        <p className="rounded-xl border border-dashed border-[#C9C6BB] px-4 py-3 text-sm text-muted">
          Choose who you are (top right) to see and log your sessions for this day.
        </p>
      ) : (
        <MySessions date={date} therapistId={therapistId} />
      )}
      <LogTable date={date} therapistId={therapistId} />
    </div>
  );
}

/** The selected therapist's sessions on `date`, each with a quick "log it" action. */
function MySessions({ date, therapistId }: { date: string; therapistId: number }) {
  const { data: sessions = [], isLoading, error } = useSessions(date);
  const { data: logs = [] } = useSessionLogs({ date, therapistId });
  const { data: students = [] } = useStudents();
  const [open, setOpen] = useState<number | null>(null);
  const mine = sessions.filter((s) => s.therapistId === therapistId);

  return (
    <section className="space-y-3">
      <h2 className="text-[17px] font-bold">My sessions — {formatCaseDate(date)}</h2>
      <QueryState isLoading={isLoading} error={error} isEmpty={mine.length === 0} emptyText="No sessions scheduled for you today." />
      <ul className="grid items-start gap-4 lg:grid-cols-2">
        {mine.map((s) => {
          const log = logs.find((l) => l.sessionId === s.id);
          const student = students.find((item) => item.id === s.studentId);
          const isNewTherapist = student && (s.originalTherapistId !== null
            ? s.originalTherapistId !== therapistId
            : student.teamTherapistIds.length > 0 && !student.teamTherapistIds.includes(therapistId));
          const isOpen = open === s.id;
          return (
            <li
              key={s.id}
              className={`flex flex-col gap-4 rounded-2xl border bg-white px-5 py-4 ${isOpen ? "border-brand ring-1 ring-brand lg:col-span-2" : "border-line"} ${s.status === "cancelled" ? "bg-subtle" : ""}`}
            >
              <div className="flex flex-wrap items-center gap-3.5">
                <div className={`shrink-0 rounded-[10px] px-2.5 py-1.5 text-center ${isOpen ? "bg-brand-soft text-brand" : "bg-sunk text-ink-soft"}`}>
                  <div className="text-[11px] font-extrabold">{s.slot}</div>
                  <div className="text-[15px] font-extrabold">{formatTime(s.startTime).replace(/ (AM|PM)$/, "")}</div>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-base font-extrabold">{s.studentName}</div>
                  <div className="text-[13px] text-muted">
                    {formatTime(s.startTime)} – {formatTime(s.endTime)} · <span className="capitalize">{s.location}</span>
                  </div>
                </div>
                {s.originalTherapistId !== null && s.originalTherapistId !== therapistId && <Badge tone="info">Covering</Badge>}
                {s.status === "cancelled" && <Badge tone="danger">Cancelled</Badge>}
                {log ? (
                  <Badge tone="success">
                    <Icon name="check" size={14} strokeWidth={2.6} />
                    Logged · {log.attendance}
                  </Badge>
                ) : (
                  <Button variant={isOpen ? "secondary" : "primary"} onClick={() => setOpen(isOpen ? null : s.id)}>
                    {isOpen ? "Close" : "Log session"}
                  </Button>
                )}
              </div>
              {isOpen && (
                <div className="border-t border-line-soft pt-4">
                  <LogForm
                    preset={{ sessionId: s.id, date, slot: s.slot, studentId: s.studentId, therapistId }}
                    onDone={() => setOpen(null)}
                  />
                </div>
              )}
              {isNewTherapist && <TakeoverHandover studentId={s.studentId} date={date} slot={s.slot} />}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function TakeoverHandover({
  studentId,
  date,
  slot,
}: {
  studentId: number;
  date: string;
  slot: "AM" | "PM";
}) {
  const { data: logs = [] } = useSessionLogs({ studentId });
  const prepare = usePrepareVideoHandover();
  const isPrior = (log: SessionLog) => log.date < date || (log.date === date && log.slot < slot);
  const previous = logs.find(isPrior);
  const videoLog = logs.find((log) => isPrior(log) && log.videoReview);

  useEffect(() => {
    if (previous) prepare.mutate({ studentId, date, slot });
  }, [studentId, date, slot, previous?.id]);

  return (
    <div className="border-t border-line-soft pt-3">
      <p className="mb-2 text-xs font-bold tracking-wide text-muted uppercase">New therapist handover</p>
      {videoLog ? (
        <>
          <p className="mb-2 text-xs text-muted">
            Prior recording · {formatCaseDate(videoLog.date)} · {videoLog.slot}
            {prepare.isPending ? " · Preparing highlights…" : ""}
          </p>
          <SessionVideoPanel log={videoLog} expanded />
        </>
      ) : (
        <p className="rounded-xl bg-subtle px-4 py-3 text-sm text-muted">No earlier session video is available for handover.</p>
      )}
      {prepare.error && <p className="mt-2 text-sm font-semibold text-bad">Video handover could not be prepared: {prepare.error.message}</p>}
    </div>
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
  const grid = "md:grid md:grid-cols-[150px_110px_150px_110px_minmax(180px,1fr)_170px] md:gap-3.5 md:items-start";

  return (
    <Card
      title={therapistId === "" ? "All logs" : "My logs"}
      flush
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Tabs
            label="Dates"
            value={scope}
            onChange={setScope}
            tabs={[
              { value: "day", label: "This date" },
              { value: "all", label: "All dates" },
            ]}
          />
          <select className={inputClass} value={studentId} onChange={(e) => setStudentId(e.target.value ? Number(e.target.value) : "")} aria-label="Child">
            <option value="">All children</option>
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <Button onClick={() => setAdding(true)}>
            <Icon name="plus" size={16} strokeWidth={2.4} />
            New log
          </Button>
        </div>
      }
    >
      <div className="px-5 py-3 empty:hidden">
        <QueryState isLoading={isLoading} error={error} isEmpty={data.length === 0} emptyText="No logs match these filters." />
      </div>
      {data.length > 0 && (
        <>
          <div className={`hidden bg-subtle px-5 py-2.5 text-xs font-bold tracking-wide text-muted uppercase ${grid}`}>
            <span>Date</span>
            <span>Child</span>
            <span>Therapist</span>
            <span>Attendance</span>
            <span>Summary</span>
            <span />
          </div>
          <ul>
            {data.map((l) => (
              <li key={l.id} className={`flex flex-col gap-1.5 border-t border-line-soft px-5 py-3.5 text-sm ${grid}`}>
                <div className="flex items-center gap-1.5 whitespace-nowrap">
                  {formatCaseDate(l.date)} <Badge>{l.slot}</Badge>
                </div>
                <div className="font-bold">{l.studentName}</div>
                <div>
                  {l.therapistName}
                  {teams.size > 0 && !teams.get(l.studentId)?.has(l.therapistId) && (
                    <span className="ml-1.5">
                      <Badge tone="info">cover</Badge>
                    </span>
                  )}
                </div>
                <div>
                  <Badge tone={ATTENDANCE_TONE[l.attendance]}>
                    <span className="capitalize">{l.attendance}</span>
                  </Badge>
                </div>
                <div className="space-y-2 text-ink-soft">
                  <div>{l.summary ?? "—"}</div>
                  <SessionVideoPanel log={l} />
                </div>
                <div className="flex gap-0.5 md:justify-end">
                  <a
                    className="rounded-md px-1.5 py-1 text-[13px] font-bold text-brand underline-offset-3 hover:underline"
                    href={logPdfUrl(l.id)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    PDF
                  </a>
                  <LinkButton onClick={() => setEditing(l)}>Edit</LinkButton>
                  <LinkButton
                    tone="danger"
                    onClick={() => window.confirm(`Delete the log for ${l.studentName} on ${l.date}?`) && del.mutate(l.id)}
                  >
                    Delete
                  </LinkButton>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
      {del.error && <p className="px-5 pb-3 text-sm font-semibold text-bad">{del.error.message}</p>}
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
