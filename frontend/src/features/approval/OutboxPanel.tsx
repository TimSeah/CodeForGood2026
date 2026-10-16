import { Badge, Card, QueryState } from "@/components/ui";
import { Icon } from "@/components/icons";
import { formatTimestamp, maskPhone } from "@/lib/format";
import { useNotifications } from "./api";

const PURPOSE: Record<string, { label: string; tone: "info" | "brand" | "neutral" | "danger" }> = {
  parent_confirm: { label: "Parent: please confirm", tone: "info" },
  parent_cancelled: { label: "Parent: session cancelled", tone: "danger" },
  parent_call_centre: { label: "Parent: call the centre", tone: "info" },
  therapist_cover: { label: "Therapist: cover request + handover", tone: "brand" },
  therapist_confirmed: { label: "Therapist: confirmed", tone: "brand" },
  therapist_stand_down: { label: "Therapist: stand down", tone: "neutral" },
};

/** Messages queued for WhatsApp. Until the bot can send, they stay here with status "placeholder". */
export function OutboxPanel({ date }: { date: string }) {
  const { data = [], isLoading, error } = useNotifications(date);
  return (
    <Card
      title="WhatsApp outbox"
      count={data.length}
      subtitle="Not sent: the WhatsApp bot can’t send messages yet. These go out once it’s connected."
      actions={<Badge tone="warning">Not sent yet</Badge>}
      flush
    >
      <div className="bg-[#EFEDE6] px-5 py-4">
        <QueryState isLoading={isLoading} error={error} isEmpty={data.length === 0} emptyText="No messages yet." />
        <ul className="space-y-4">
          {data.map((n) => {
            const purpose = PURPOSE[n.purpose] ?? { label: n.purpose, tone: "neutral" as const };
            return (
              <li key={n.id} className="flex flex-col gap-1.5">
                <div className="flex flex-wrap items-center gap-2 text-[13px]">
                  <strong>{n.recipientName ?? n.recipientType}</strong>
                  <span className="text-muted">{maskPhone(n.toPhone)}</span>
                  <Badge tone={purpose.tone}>{purpose.label}</Badge>
                  <Badge tone="warning">{n.status}</Badge>
                  <span className="ml-auto text-muted">{formatTimestamp(n.createdAt)}</span>
                </div>
                <div className="max-w-[640px] self-start rounded-[4px_14px_14px_14px] bg-white px-3.5 py-3 text-sm leading-relaxed shadow-sm">
                  <p className="whitespace-pre-wrap">{n.body}</p>
                  {n.attachment && (
                    <a
                      href={n.attachment}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2.5 flex items-center gap-2 rounded-lg bg-paper px-2.5 py-2 text-[13px] font-bold text-brand hover:bg-sunk"
                    >
                      <Icon name="file" size={16} />
                      Last-session log (PDF)
                    </a>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </Card>
  );
}
