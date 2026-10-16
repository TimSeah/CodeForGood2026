import { Link } from "react-router";
import { Callout, Card, DateInput, PageHeader } from "@/components/ui";
import { Icon } from "@/components/icons";
import { AbsencePanel } from "@/features/absences/AbsencePanel";
import { usePlans } from "@/features/approval/api";
import { AddReportForm } from "@/features/intake/AddReportForm";
import { useBotReports, useBotSync } from "@/features/intake/api";
import { BotReportsPanel } from "@/features/intake/BotReportsPanel";
import { useSelectedDate } from "@/hooks/useSelectedDate";

/** 7 AM view: what came in via WhatsApp, who is away, and whether a plan is waiting for approval. */
export function DisruptionsPage() {
  const [date, setDate] = useSelectedDate();
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="7 AM briefing"
        title="Today’s disruptions"
        actions={
          <>
            <SyncStatus />
            <DateInput value={date} onChange={setDate} />
          </>
        }
      />
      <Summary date={date} />
      <BotReportsPanel date={date} />
      <div className="grid items-start gap-5 lg:grid-cols-2">
        <AbsencePanel date={date} />
        <Card title="Add a report by hand" subtitle="For phone calls — the same details the WhatsApp bot collects.">
          <AddReportForm date={date} />
        </Card>
      </div>
    </div>
  );
}

function SyncStatus() {
  const { data, error } = useBotSync();
  const [dot, text, title] = error
    ? ["bg-bad", "WhatsApp sync failed", error.message]
    : !data
      ? ["bg-field", "Syncing WhatsApp…", ""]
      : data.available
        ? ["bg-[#2E8B57]", `WhatsApp synced ${data.syncedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`, data.path]
        : ["bg-[#E9B44C]", "Bot DB not found — showing reports entered here", data.path];
  return (
    <span className="inline-flex min-h-10 items-center gap-2 rounded-full border border-line bg-white px-3.5 text-[13px] font-semibold text-ink-soft" title={title}>
      <span className={`size-2.5 rounded-full ${dot}`} aria-hidden="true" />
      {text}
    </span>
  );
}

function Summary({ date }: { date: string }) {
  const { data: reports = [] } = useBotReports(date);
  const { data: plans = [] } = usePlans(date);
  const draft = plans.find((p) => p.status === "draft" && p.kind !== "swap_alternative");
  const alternative = plans.find((p) => p.status === "draft" && p.kind === "swap_alternative");
  const approved = plans.filter((p) => p.status === "approved");
  const unmatched = reports.filter((r) => r.status === "unmatched").length;
  const cancels = draft?.assignments.filter((a) => a.toTherapistId === null).length ?? 0;
  const covered = (draft?.assignments.length ?? 0) - cancels;
  const errors = draft?.issues.filter((i) => i.level === "error").length ?? 0;
  const awaiting = approved.flatMap((p) => p.assignments).filter((a) => a.parentStatus === "pending").length;
  const visible = reports.filter((r) => r.status !== "ignored");

  const stats = [
    { label: "Therapist reports", value: reports.filter((r) => r.role === "therapist").length, box: "bg-paper", fg: "" },
    { label: "Child absences", value: reports.filter((r) => r.role === "patient").length, box: "bg-paper", fg: "" },
    { label: "Sessions covered", value: covered, box: "bg-good-bg", fg: "text-good" },
    { label: "Proposed cancellations", value: cancels, box: cancels ? "bg-bad-bg" : "bg-paper", fg: cancels ? "text-bad" : "" },
  ];

  const current = unmatched > 0 || (!draft && approved.length === 0) ? 1 : draft ? 2 : 3;
  const steps = [
    { title: "Reports in", detail: `${visible.length} received${unmatched ? ` · ${unmatched} need a match` : ""}`, to: "/" },
    { title: "Review plan", detail: draft ? `Draft ready · ${draft.assignments.length} changes` : approved.length ? "Approved" : "No draft yet", to: "/approval" },
    { title: "Parents confirm", detail: approved.length ? `${awaiting} awaiting reply` : "After approval", to: "/replies" },
  ];

  return (
    <>
      <ol aria-label="Progress" className="grid gap-2 sm:grid-cols-3">
        {steps.map((s, i) => {
          const n = i + 1;
          const active = n === current;
          return (
            <li key={s.title}>
              <Link
                to={`${s.to}?date=${date}`}
                aria-current={active ? "step" : undefined}
                className={`flex h-full items-center gap-3 rounded-xl px-4 py-3 ${active ? "bg-brand text-white" : "border border-line bg-white hover:bg-subtle"}`}
              >
                <span
                  className={`flex size-7 shrink-0 items-center justify-center rounded-full text-[13px] font-extrabold ${
                    active ? "bg-white/20" : n < current ? "bg-brand-soft text-brand" : "bg-sunk text-muted"
                  }`}
                >
                  {n < current ? <Icon name="check" size={15} strokeWidth={3} /> : n}
                </span>
                <span>
                  <span className="block text-sm font-bold">{s.title}</span>
                  <span className={`block text-xs ${active ? "text-white/85" : "text-muted"}`}>{s.detail}</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ol>

      <section className="flex flex-wrap items-center justify-between gap-6 rounded-2xl border border-line bg-white p-6">
        <dl className="grid flex-[1_1_520px] grid-cols-2 gap-3 md:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className={`rounded-xl px-4 py-3.5 ${s.box}`}>
              <dt className={`text-[13px] font-semibold ${s.fg || "text-muted"}`}>{s.label}</dt>
              <dd className={`mt-1 text-[34px] leading-tight font-extrabold ${s.fg}`}>{s.value}</dd>
            </div>
          ))}
        </dl>
        {draft ? (
          <Link
            to={`/approval?date=${date}`}
            className="inline-flex min-h-13 items-center gap-2 rounded-[10px] bg-brand px-5 text-[15px] font-semibold text-white hover:bg-brand-hover"
          >
            Review draft plan · {draft.assignments.length} changes
            <Icon name="arrow" />
          </Link>
        ) : (
          <span className="text-sm text-muted">No draft plan waiting for approval.</span>
        )}
      </section>

      {(unmatched > 0 || errors > 0 || alternative) && (
        <div className="space-y-2">
          {unmatched > 0 && (
            <Callout tone="warning" action={<a href="#reports" className="font-bold underline-offset-3 hover:underline">Match now</a>}>
              {unmatched} report{unmatched === 1 ? "" : "s"} need{unmatched === 1 ? "s" : ""} a name match before {unmatched === 1 ? "it counts" : "they count"}.
            </Callout>
          )}
          {errors > 0 && (
            <Callout tone="danger" action={<Link to={`/approval?date=${date}`} className="font-bold underline-offset-3 hover:underline">Fix in review</Link>}>
              The draft has {errors} error{errors === 1 ? "" : "s"} to fix before approval.
            </Callout>
          )}
          {alternative && (
            <Callout tone="info" action={<Link to={`/approval?date=${date}`} className="font-bold underline-offset-3 hover:underline">Compare plans</Link>}>
              A swap alternative is available that avoids a cancellation.
            </Callout>
          )}
        </div>
      )}
    </>
  );
}
