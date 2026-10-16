import type { Session } from "@/api/types";
import { Badge, Card, DateInput, QueryState } from "@/components/ui";
import { useSelectedDate } from "@/hooks/useSelectedDate";
import { formatTime } from "@/lib/format";
import { useSessions } from "./api";

export function SchedulePage() {
  const [date, setDate] = useSelectedDate();
  const { data = [], isLoading, error } = useSessions(date);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Schedule</h1>
        <DateInput value={date} onChange={setDate} />
      </div>
      <Card title={`Sessions on ${date}`}>
        <QueryState isLoading={isLoading} error={error} isEmpty={data.length === 0} emptyText="No sessions this day." />
        {data.length > 0 && <SessionTable sessions={data} />}
      </Card>
    </div>
  );
}

function SessionTable({ sessions }: { sessions: Session[] }) {
  return (
    <table className="w-full text-left text-sm">
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
        {sessions.map((s) => (
          <tr key={s.id}>
            <td className="py-2">{s.slot}</td>
            <td>
              {formatTime(s.startTime)} – {formatTime(s.endTime)}
            </td>
            <td>{s.studentName}</td>
            <td>
              {s.therapistName ?? "—"}
              {s.originalTherapistId !== null && <Badge tone="info">reassigned</Badge>}
            </td>
            <td className="capitalize">{s.location}</td>
            <td>
              {s.status === "cancelled" ? <Badge tone="danger">cancelled</Badge> : <Badge tone="success">scheduled</Badge>}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
