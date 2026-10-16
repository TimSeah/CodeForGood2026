import { Badge, Card, QueryState } from "@/components/ui";
import { formatTimestamp, maskPhone } from "@/lib/format";
import { useNotifications } from "./api";

const PURPOSE_LABEL: Record<string, string> = {
  parent_confirm: "Parent: please confirm",
  parent_cancelled: "Parent: session cancelled",
  parent_call_centre: "Parent: call the centre",
  therapist_cover: "Therapist: cover request + handover",
  therapist_confirmed: "Therapist: confirmed",
  therapist_stand_down: "Therapist: stand down",
};

/** Messages queued for WhatsApp. Until the bot can send, they stay here with status "placeholder". */
export function OutboxPanel({ date }: { date: string }) {
  const { data = [], isLoading, error } = useNotifications(date);
  return (
    <Card title={`WhatsApp outbox (${data.length})`}>
      <p className="mb-3 text-xs text-amber-700">
        Not sent: the WhatsApp bot can't send messages yet. These messages will go out once it's connected.
      </p>
      <QueryState isLoading={isLoading} error={error} isEmpty={data.length === 0} emptyText="No messages yet." />
      <ul className="space-y-3">
        {data.map((n) => (
          <li key={n.id} className="rounded-md border border-slate-200 p-3 text-sm">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <span className="font-medium">{n.recipientName ?? n.recipientType}</span>
              <span className="text-xs text-slate-500">{maskPhone(n.toPhone)}</span>
              <Badge tone="info">{PURPOSE_LABEL[n.purpose] ?? n.purpose}</Badge>
              <Badge tone="warning">{n.status}</Badge>
              <span className="ml-auto text-xs text-slate-400">{formatTimestamp(n.createdAt)}</span>
            </div>
            <p className="whitespace-pre-wrap text-slate-700">{n.body}</p>
            {n.attachment && (
              <a href={n.attachment} target="_blank" rel="noreferrer" className="mt-1 inline-block text-xs text-sky-700 underline">
                📎 Last-session log (PDF)
              </a>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}
