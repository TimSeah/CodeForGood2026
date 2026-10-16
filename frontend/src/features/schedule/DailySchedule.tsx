import type { Session } from "@/api/types";
import { Badge, Card, QueryState } from "@/components/ui";
import { formatCaseDate, formatTime, PARENT_STATUS_LABEL } from "@/lib/format";
import { useSessions } from "./api";

const SLOTS = [
  { slot: "AM", name: "Morning" },
  { slot: "PM", name: "Afternoon" },
] as const;

/** Every session on one date as it stands now (approved changes applied), split into morning and afternoon. */
export function DailySchedule({ date }: { date: string }) {
  const { data = [], isLoading, error } = useSessions(date);
  const reassigned = data.filter((s) => s.originalTherapistId !== null).length;
  const cancelled = data.filter((s) => s.status === "cancelled").length;
  const awaiting = data.filter((s) => s.parentStatus === "pending").length;

  if (isLoading || error || data.length === 0) {
    return (
      <Card title={`Sessions on ${formatCaseDate(date)}`}>
        <QueryState isLoading={isLoading} error={error} isEmpty={data.length === 0} emptyText="No sessions this day." />
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Badge>{data.length} sessions</Badge>
        {reassigned > 0 && <Badge tone="info">{reassigned} reassigned</Badge>}
        {cancelled > 0 && <Badge tone="danger">{cancelled} cancelled</Badge>}
        {awaiting > 0 && <Badge tone="warning">{awaiting} awaiting parent</Badge>}
      </div>
      <div className="grid items-start gap-5 xl:grid-cols-2">
        {SLOTS.map(({ slot, name }) => {
          const rows = data.filter((s) => s.slot === slot);
          return (
            <Card key={slot} title={name} count={rows.length} flush>
              {rows.length === 0 ? (
                <p className="px-5 py-4 text-sm text-muted">No sessions.</p>
              ) : (
                <ul>
                  {rows.map((s) => (
                    <SessionRow key={s.id} s={s} />
                  ))}
                </ul>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function SessionRow({ s }: { s: Session }) {
  const cancelled = s.status === "cancelled";
  return (
    <li className={`grid grid-cols-[84px_minmax(0,1fr)_auto] items-center gap-3.5 border-t border-line-soft px-5 py-3 first:border-t-0 ${cancelled ? "bg-[#FDF8F7]" : ""}`}>
      <div className="text-[13px] font-bold text-ink-soft">
        {formatTime(s.startTime)}
        <div className="font-normal text-muted">{formatTime(s.endTime)}</div>
      </div>
      <div className="min-w-0">
        <div className={`font-bold ${cancelled ? "line-through" : ""}`}>{s.studentName}</div>
        <div className="text-[13px] font-semibold">
          {s.therapistName ? (
            <span className={s.originalTherapistId !== null ? "text-info" : "text-muted"}>{s.therapistName}</span>
          ) : (
            <span className="text-warn">Needs cover</span>
          )}
        </div>
      </div>
      <div className="flex flex-wrap justify-end gap-1.5">
        <Badge>
          <span className="capitalize">{s.location}</span>
        </Badge>
        {s.originalTherapistId !== null && <Badge tone="info">Reassigned</Badge>}
        {cancelled ? (
          <span title={s.cancelReason ?? ""}>
            <Badge tone="danger">Cancelled</Badge>
          </span>
        ) : (
          <Badge tone="success">Scheduled</Badge>
        )}
        {s.parentStatus && s.parentStatus !== "not_required" && (
          <Badge tone={s.parentStatus === "accepted" ? "success" : "warning"}>{PARENT_STATUS_LABEL[s.parentStatus]}</Badge>
        )}
      </div>
    </li>
  );
}
