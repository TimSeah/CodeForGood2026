import { useState } from "react";
import type { BotReport } from "@/api/types";
import { Badge, Button, Card, inputClass, QueryState } from "@/components/ui";
import { useStudents, useTherapists } from "@/features/reference/api";
import { formatCaseDate, formatReportedAt, maskPhone } from "@/lib/format";
import { useBotReports, useResolveReport } from "./api";

const DAY_PART_LABEL = { "whole day": "Full day", morning: "AM", afternoon: "PM" } as const;

/** What the WhatsApp bot collected, split into therapist and parent reports. */
export function BotReportsPanel({ date }: { date: string }) {
  const { data = [], isLoading, error } = useBotReports(date);
  const visible = data.filter((r) => r.status !== "ignored");
  const therapists = visible.filter((r) => r.role === "therapist");
  const patients = visible.filter((r) => r.role === "patient");

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card title={`Therapist reports (${therapists.length})`}>
        <QueryState isLoading={isLoading} error={error} isEmpty={therapists.length === 0} emptyText="No therapist reports." />
        <ReportList reports={therapists} date={date} />
      </Card>
      <Card title={`Parent / child reports (${patients.length})`}>
        <QueryState isLoading={isLoading} error={error} isEmpty={patients.length === 0} emptyText="No child absences reported." />
        <ReportList reports={patients} date={date} />
      </Card>
    </div>
  );
}

function ReportList({ reports, date }: { reports: BotReport[]; date: string }) {
  // Unmatched first: they need the admin.
  const sorted = [...reports].sort((a, b) => Number(b.status === "unmatched") - Number(a.status === "unmatched"));
  return (
    <ul className="divide-y divide-slate-100">
      {sorted.map((r) => (
        <ReportRow key={r.id} r={r} date={date} />
      ))}
    </ul>
  );
}

function ReportRow({ r, date }: { r: BotReport; date: string }) {
  const unmatched = r.status === "unmatched";
  const range = r.startDate === r.endDate ? formatCaseDate(r.startDate) : `${formatCaseDate(r.startDate)} – ${formatCaseDate(r.endDate)}`;
  return (
    <li className={`py-2.5 text-sm ${unmatched ? "-mx-2 rounded-md bg-amber-50 px-2" : ""}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{r.matchedName ?? r.name}</span>
          {r.matchedName && r.matchedName.toLowerCase() !== r.name.toLowerCase() && (
            <span className="text-slate-500">(typed “{r.name}”)</span>
          )}
          <Badge tone={r.dayPart === "whole day" ? "danger" : "warning"}>{DAY_PART_LABEL[r.dayPart]}</Badge>
          {r.mcAttached && <Badge tone="info">MC attached</Badge>}
        </div>
        <span className="text-xs text-slate-500">{formatReportedAt(r.reportedAt, date)}</span>
      </div>
      <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-slate-500">
        <span>{range}</span>
        <span>{maskPhone(r.phone)}</span>
        {!unmatched && (
          <span>
            {r.affectedSessions} session{r.affectedSessions === 1 ? "" : "s"} {r.role === "therapist" ? "need cover" : "cancelled"}
          </span>
        )}
      </div>
      {unmatched && <ResolveReport r={r} />}
    </li>
  );
}

/** The name didn't match the roster: the admin picks the right person (then it's ingested and re-planned) or ignores it. */
function ResolveReport({ r }: { r: BotReport }) {
  const { data: therapists = [] } = useTherapists();
  const { data: students = [] } = useStudents();
  const resolve = useResolveReport();
  const [pick, setPick] = useState("");
  const options = r.role === "therapist" ? therapists : students;

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <span className="text-xs font-medium text-amber-800">Name not on the roster —</span>
      <select className={inputClass} value={pick} onChange={(e) => setPick(e.target.value)} aria-label="Match to">
        <option value="">Match to…</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
      <Button
        disabled={!pick || resolve.isPending}
        onClick={() =>
          resolve.mutate(r.role === "therapist" ? { id: r.id, therapistId: Number(pick) } : { id: r.id, studentId: Number(pick) })
        }
      >
        Confirm
      </Button>
      <Button variant="secondary" disabled={resolve.isPending} onClick={() => resolve.mutate({ id: r.id, ignore: true })}>
        Ignore
      </Button>
      {resolve.error && <span className="text-xs text-rose-600">{resolve.error.message}</span>}
    </div>
  );
}
