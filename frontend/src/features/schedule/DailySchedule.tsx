import type { Session } from "@/api/types";
import { Badge, Card, QueryState } from "@/components/ui";
import { formatCaseDate, formatTime, PARENT_STATUS_LABEL } from "@/lib/format";
import { useSessions } from "./api";

/** Every session on one date as it stands now (approved changes applied). */
export function DailySchedule({ date }: { date: string }) {
  const { data = [], isLoading, error } = useSessions(date);
  return (
    <Card title={`Sessions on ${formatCaseDate(date)}`}>
      <QueryState isLoading={isLoading} error={error} isEmpty={data.length === 0} emptyText="No sessions this day." />
      {data.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="text-slate-500">
              <tr>
                <th className="py-2">Slot</th>
                <th>Time</th>
                <th>Child</th>
                <th>Therapist</th>
                <th>Location</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.map((s) => (
                <SessionRow key={s.id} s={s} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function SessionRow({ s }: { s: Session }) {
  return (
    <tr>
      <td className="py-2">{s.slot}</td>
      <td className="whitespace-nowrap">
        {formatTime(s.startTime)} – {formatTime(s.endTime)}
      </td>
      <td>{s.studentName}</td>
      <td>
        {s.therapistName ?? <span className="text-amber-700">needs cover</span>}
        {s.originalTherapistId !== null && (
          <span className="ml-1">
            <Badge tone="info">reassigned</Badge>
          </span>
        )}
      </td>
      <td className="capitalize">{s.location}</td>
      <td className="space-x-1">
        {s.status === "cancelled" ? (
          <span title={s.cancelReason ?? ""}>
            <Badge tone="danger">cancelled</Badge>
          </span>
        ) : (
          <Badge tone="success">scheduled</Badge>
        )}
        {s.parentStatus && s.parentStatus !== "not_required" && (
          <Badge tone={s.parentStatus === "accepted" ? "success" : "warning"}>{PARENT_STATUS_LABEL[s.parentStatus]}</Badge>
        )}
      </td>
    </tr>
  );
}
