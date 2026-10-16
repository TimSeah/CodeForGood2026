import { Link } from "react-router";
import { Card, DateInput } from "@/components/ui";
import { AbsencePanel } from "@/features/absences/AbsencePanel";
import { usePlans } from "@/features/approval/api";
import { AddReportForm } from "@/features/intake/AddReportForm";
import { useBotReports, useBotSync } from "@/features/intake/api";
import { BotReportsPanel } from "@/features/intake/BotReportsPanel";
import { useSelectedDate } from "@/hooks/useSelectedDate";
import { formatCaseDate } from "@/lib/format";

/** 7 AM view: what came in via WhatsApp, who is away, and whether a plan is waiting for approval. */
export function DisruptionsPage() {
  const [date, setDate] = useSelectedDate();
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold">Disruptions</h1>
          <p className="text-sm text-slate-500">{formatCaseDate(date)}</p>
        </div>
        <div className="flex items-center gap-3">
          <SyncStatus />
          <DateInput value={date} onChange={setDate} />
        </div>
      </div>
      <Summary date={date} />
      <BotReportsPanel date={date} />
      <AbsencePanel date={date} />
      <Card title="Add a report manually">
        <AddReportForm date={date} />
      </Card>
    </div>
  );
}

function SyncStatus() {
  const { data, error } = useBotSync();
  if (error) return <span className="text-xs text-rose-600">WhatsApp sync failed</span>;
  if (!data) return <span className="text-xs text-slate-400">Syncing WhatsApp…</span>;
  return (
    <span className="text-xs text-slate-500" title={data.path}>
      {data.available ? `WhatsApp synced ${data.syncedAt.toLocaleTimeString()}` : "WhatsApp bot DB not found — showing reports entered here"}
    </span>
  );
}

function Summary({ date }: { date: string }) {
  const { data: reports = [] } = useBotReports(date);
  const { data: plans = [] } = usePlans(date);
  const draft = plans.find((p) => p.status === "draft" && p.kind !== "swap_alternative");
  const alternative = plans.find((p) => p.status === "draft" && p.kind === "swap_alternative");
  const unmatched = reports.filter((r) => r.status === "unmatched").length;
  const cancels = draft?.assignments.filter((a) => a.toTherapistId === null).length ?? 0;
  const covered = (draft?.assignments.length ?? 0) - cancels;
  const errors = draft?.issues.filter((i) => i.level === "error").length ?? 0;

  const stats = [
    { label: "Therapist reports", value: reports.filter((r) => r.role === "therapist").length },
    { label: "Child absences", value: reports.filter((r) => r.role === "patient").length },
    { label: "Sessions covered", value: covered },
    { label: "Proposed cancellations", value: cancels, tone: cancels ? "text-rose-600" : "" },
  ];

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <dl className="flex flex-wrap gap-6">
          {stats.map((s) => (
            <div key={s.label}>
              <dt className="text-xs text-slate-500">{s.label}</dt>
              <dd className={`text-2xl font-semibold ${s.tone ?? ""}`}>{s.value}</dd>
            </div>
          ))}
        </dl>
        {draft ? (
          <Link
            to={`/approval?date=${date}`}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
          >
            Review draft plan ({draft.assignments.length} changes) →
          </Link>
        ) : (
          <span className="text-sm text-slate-500">No draft plan waiting for approval.</span>
        )}
      </div>
      {(unmatched > 0 || errors > 0 || alternative) && (
        <ul className="mt-3 space-y-1 text-sm">
          {unmatched > 0 && <li className="text-amber-700">⚠ {unmatched} report(s) need a name match before they count.</li>}
          {errors > 0 && <li className="text-rose-700">⚠ The draft has {errors} error(s) to fix before approval.</li>}
          {alternative && <li className="text-sky-700">ℹ A swap alternative is available that avoids a cancellation.</li>}
        </ul>
      )}
    </section>
  );
}
