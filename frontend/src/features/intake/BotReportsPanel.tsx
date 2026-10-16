import { useState } from "react";
import type { BotReport } from "@/api/types";
import { Avatar, Badge, Button, Card, inputClass, QueryState } from "@/components/ui";
import { useStudents, useTherapists } from "@/features/reference/api";
import { formatCaseDate, formatReportedAt, maskPhone } from "@/lib/format";
import { useBotReports, useResolveReport } from "./api";

const DAY_PART_LABEL = { "whole day": "Full day", morning: "AM only", afternoon: "PM only" } as const;

/** What the WhatsApp bot collected, split into therapist and parent reports. */
export function BotReportsPanel({ date }: { date: string }) {
  const { data = [], isLoading, error } = useBotReports(date);
  const visible = data.filter((r) => r.status !== "ignored");
  const therapists = visible.filter((r) => r.role === "therapist");
  const patients = visible.filter((r) => r.role === "patient");

  return (
    <div id="reports" className="grid items-start gap-5 lg:grid-cols-2">
      <Card title="Therapist reports" count={therapists.length} actions={<Badge>via WhatsApp</Badge>} flush>
        <div className="p-2">
          <div className="px-3 py-2 empty:hidden">
            <QueryState isLoading={isLoading} error={error} isEmpty={therapists.length === 0} emptyText="No therapist reports." />
          </div>
          <ReportList reports={therapists} date={date} />
        </div>
      </Card>
      <Card title="Child absences" count={patients.length} actions={<Badge>from parents</Badge>} flush>
        <div className="p-2">
          <div className="px-3 py-2 empty:hidden">
            <QueryState isLoading={isLoading} error={error} isEmpty={patients.length === 0} emptyText="No child absences reported." />
          </div>
          <ReportList reports={patients} date={date} />
        </div>
      </Card>
    </div>
  );
}

function ReportList({ reports, date }: { reports: BotReport[]; date: string }) {
  // Unmatched first: they need the admin.
  const sorted = [...reports].sort((a, b) => Number(b.status === "unmatched") - Number(a.status === "unmatched"));
  return (
    <ul className="divide-y divide-line-soft">
      {sorted.map((r) => (
        <ReportRow key={r.id} r={r} date={date} />
      ))}
    </ul>
  );
}

function ReportRow({ r, date }: { r: BotReport; date: string }) {
  const unmatched = r.status === "unmatched";
  const range = r.startDate === r.endDate ? formatCaseDate(r.startDate) : `${formatCaseDate(r.startDate)} – ${formatCaseDate(r.endDate)}`;
  const name = r.matchedName ?? r.name;
  return (
    <li className={`flex flex-col gap-3 px-3 py-3.5 ${unmatched ? "my-1 rounded-xl border border-[#F3DDB0] bg-[#FEF7EA]" : ""}`}>
      <div className="flex items-start gap-3">
        <Avatar name={unmatched ? "?" : name} tone={unmatched ? "warning" : r.role === "therapist" ? "brand" : "child"} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-bold">{unmatched ? `“${r.name}”` : name}</span>
            {!unmatched && r.matchedName && r.matchedName.toLowerCase() !== r.name.toLowerCase() && (
              <span className="text-sm text-muted">(typed “{r.name}”)</span>
            )}
            <Badge tone={r.dayPart === "whole day" ? "danger" : "warning"}>{DAY_PART_LABEL[r.dayPart]}</Badge>
            {r.mcAttached && <Badge tone="info">MC attached</Badge>}
          </div>
          {unmatched ? (
            <p className="mt-0.5 text-[13px] font-semibold text-warn">Name not on the roster — who is this?</p>
          ) : (
            <p className="mt-1 text-[13px] text-muted">
              {range} · {maskPhone(r.phone)} ·{" "}
              <strong className="text-ink">
                {r.affectedSessions} session{r.affectedSessions === 1 ? "" : "s"}{" "}
                {r.role === "therapist" ? (r.affectedSessions === 1 ? "needs cover" : "need cover") : "cancelled"}
              </strong>
            </p>
          )}
        </div>
        <span className="text-[13px] text-muted">{formatReportedAt(r.reportedAt, date)}</span>
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
    <div className="flex flex-wrap items-center gap-2 sm:pl-12">
      <select className={`${inputClass} flex-[1_1_180px]`} value={pick} onChange={(e) => setPick(e.target.value)} aria-label="Match to">
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
      {resolve.error && <span className="w-full text-xs font-semibold text-bad">{resolve.error.message}</span>}
    </div>
  );
}
