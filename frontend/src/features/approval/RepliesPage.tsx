import { Link } from "react-router";
import { Card, DateInput, PageHeader, QueryState } from "@/components/ui";
import { useSelectedDate } from "@/hooks/useSelectedDate";
import { formatTime, parentDeadline } from "@/lib/format";
import { ApprovedChanges } from "./ApprovedChanges";
import { usePlans } from "./api";
import { OutboxPanel } from "./OutboxPanel";

/** After approval: track the parents' YES/NO replies and see the WhatsApp messages queued for everyone. */
export function RepliesPage() {
  const [date, setDate] = useSelectedDate();
  const { data: plans = [], isLoading, error } = usePlans(date);
  const approved = plans.filter((p) => p.status === "approved");
  const assignments = approved.flatMap((p) => p.assignments).filter((a) => a.parentStatus !== "not_required");
  const count = (s: string) => assignments.filter((a) => a.parentStatus === s).length;
  const accepted = count("accepted");
  const declined = count("declined") + count("expired");
  const pending = count("pending");
  const next = assignments.filter((a) => a.parentStatus === "pending").sort((x, y) => x.startTime.localeCompare(y.startTime))[0];

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Step 3 of 3" title="Parent replies" actions={<DateInput value={date} onChange={setDate} />} />
      <QueryState isLoading={isLoading} error={error} />

      {!isLoading && approved.length === 0 && (
        <Card>
          <p className="text-sm text-muted">
            Nothing approved for this date yet.{" "}
            <Link to={`/approval?date=${date}`} className="font-bold">
              Review the draft plan
            </Link>{" "}
            first.
          </p>
        </Card>
      )}

      {assignments.length > 0 && (
        <section className="flex flex-col gap-3.5 rounded-2xl border border-line bg-white px-6 py-5">
          <div className="flex flex-wrap items-baseline gap-3">
            <div className="text-2xl font-extrabold">
              {assignments.length - pending} of {assignments.length} replied
            </div>
            {next && (
              <div className="text-sm text-muted">
                Next deadline {parentDeadline(next.startTime)} · {next.studentName} ({formatTime(next.startTime)} session)
              </div>
            )}
          </div>
          <div
            role="img"
            aria-label={`${accepted} accepted, ${declined} declined or expired, ${pending} waiting`}
            className="flex h-3 gap-[3px] overflow-hidden rounded-full bg-sunk"
          >
            <span style={{ flex: accepted }} className="bg-[#2E8B57]" />
            <span style={{ flex: declined }} className="bg-[#C0392B]" />
            <span style={{ flex: pending }} className="bg-[#E9B44C]" />
          </div>
          <div className="flex flex-wrap gap-5 text-[13px] font-semibold text-ink-soft">
            <Legend color="bg-[#2E8B57]">{accepted} accepted</Legend>
            <Legend color="bg-[#C0392B]">{declined} declined or no reply</Legend>
            <Legend color="bg-[#E9B44C]">{pending} waiting</Legend>
          </div>
        </section>
      )}

      <ApprovedChanges plans={approved} date={date} />
      {approved.length > 0 && <OutboxPanel date={date} />}
    </div>
  );
}

function Legend({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`size-2.5 rounded-[3px] ${color}`} aria-hidden="true" />
      {children}
    </span>
  );
}
