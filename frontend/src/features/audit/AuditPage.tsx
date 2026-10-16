import { Card, QueryState } from "@/components/ui";
import { formatTimestamp } from "@/lib/format";
import { useAuditLog } from "./api";

export function AuditPage() {
  const { data = [], isLoading, error } = useAuditLog();
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Audit log</h1>
      <Card>
        <QueryState isLoading={isLoading} error={error} isEmpty={data.length === 0} emptyText="No activity yet." />
        <ul className="divide-y divide-slate-100 text-sm">
          {data.map((e) => (
            <li key={e.id} className="flex gap-4 py-2">
              <span className="w-44 shrink-0 text-slate-500">{formatTimestamp(e.createdAt)}</span>
              <span className="w-24 shrink-0">{e.actor}</span>
              <span className="font-mono">{e.action}</span>
              <span className="text-slate-500">
                {e.entityType}
                {e.entityId !== null && ` #${e.entityId}`}
              </span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
