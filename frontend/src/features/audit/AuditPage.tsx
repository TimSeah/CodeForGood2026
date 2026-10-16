import type { AuditEntry } from "@/api/types";
import { Badge, Card, PageHeader, QueryState } from "@/components/ui";
import { useAuditLog } from "./api";

/** Plain-English labels for the audit actions the backend writes; unknown ones fall back to the raw name. */
const ACTION_LABEL: Record<string, string> = {
  "absence.created": "Recorded an absence",
  "bot_report.ingested": "Took in a WhatsApp report",
  "bot_report.unmatched": "WhatsApp report needs a name match",
  "bot_report.ignored": "Ignored a WhatsApp report",
  "parent.expired": "Parent didn’t reply in time",
  "plan.generated": "Generated a draft plan",
  "plan.approved": "Approved a plan",
  "plan.rejected": "Rejected a plan",
  "plan.assignment_edited": "Changed a replacement",
  "plan.assignment_rejected": "Rejected a proposed therapist",
  "plan.assignment_reject_undone": "Undid a reject",
  "session_log.created": "Logged a session",
  "session_log.updated": "Edited a session log",
  "session_log.deleted": "Deleted a session log",
};

const DOT: Record<string, string> = { approved: "bg-brand", rejected: "bg-[#C0392B]", deleted: "bg-[#C0392B]", expired: "bg-[#C0392B]", unmatched: "bg-[#E9B44C]" };

const toDate = (sqliteUtc: string) => new Date(sqliteUtc.replace(" ", "T") + "Z");

export function AuditPage() {
  const { data = [], isLoading, error } = useAuditLog();
  // Group by local day, keeping the API's order (newest first).
  const groups = new Map<string, AuditEntry[]>();
  for (const e of data) {
    const day = toDate(e.createdAt).toLocaleDateString([], { weekday: "short", day: "numeric", month: "long", year: "numeric" });
    groups.set(day, [...(groups.get(day) ?? []), e]);
  }

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Every change, recorded" title="Audit trail" />
      <Card>
        <QueryState isLoading={isLoading} error={error} isEmpty={data.length === 0} emptyText="No activity yet." />
        <ol className="space-y-5">
          {[...groups].map(([day, entries]) => (
            <li key={day}>
              <h2 className="pb-2 text-[13px] font-extrabold text-muted">{day}</h2>
              <ol className="ml-1.5 border-l-2 border-line">
                {entries.map((e) => (
                  <li
                    key={e.id}
                    className="relative grid grid-cols-[64px_minmax(0,1fr)] gap-x-3.5 gap-y-1 py-2.5 pl-5 text-sm sm:grid-cols-[64px_96px_minmax(0,1fr)_auto] sm:items-baseline"
                  >
                    <span
                      className={`absolute top-[15px] -left-[7px] size-3 rounded-full border-2 border-white ${DOT[e.action.split(".").pop()!] ?? "bg-[#9AA39F]"}`}
                      aria-hidden="true"
                    />
                    <span className="font-semibold text-muted">
                      {toDate(e.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                    <span className="font-bold">{e.actor}</span>
                    <span className="col-span-2 sm:col-span-1">
                      {ACTION_LABEL[e.action] ?? e.action}
                      {ACTION_LABEL[e.action] && <span className="ml-2 font-mono text-xs text-muted">{e.action}</span>}
                    </span>
                    <span className="col-span-2 sm:col-span-1">
                      <Badge tone="brand">
                        {e.entityType}
                        {e.entityId !== null && ` #${e.entityId}`}
                      </Badge>
                    </span>
                  </li>
                ))}
              </ol>
            </li>
          ))}
        </ol>
      </Card>
    </div>
  );
}
