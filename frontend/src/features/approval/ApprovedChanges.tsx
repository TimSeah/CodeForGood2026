import { useState } from "react";
import type { ParentStatus, Plan } from "@/api/types";
import { Badge, Button, Card, inputClass } from "@/components/ui";
import { PARENT_STATUS_LABEL, parentDeadline } from "@/lib/format";
import { useParentResponse, useRunDeadlineCheck } from "./api";

const STATUS_TONE: Record<ParentStatus, "success" | "warning" | "danger" | "neutral"> = {
  pending: "warning",
  accepted: "success",
  declined: "danger",
  expired: "danger",
  not_required: "neutral",
};

/** Approved changes and the parents' answers. In manual mode (or after a phone call) the admin records them here. */
export function ApprovedChanges({ plans, date }: { plans: Plan[]; date: string }) {
  const respond = useParentResponse();
  const rows = plans.flatMap((p) => p.assignments.map((a) => ({ a, plan: p })));
  if (rows.length === 0) return null;

  return (
    <Card title="Approved changes" actions={<DeadlineCheck date={date} />}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[680px] text-left text-sm">
          <thead className="text-xs text-slate-500">
            <tr>
              <th className="py-2">Slot</th>
              <th>Child</th>
              <th>Change</th>
              <th>Messages</th>
              <th>Parent</th>
              <th />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map(({ a, plan }) => (
              <tr key={a.id}>
                <td className="py-2">
                  <Badge>{a.slot}</Badge>
                </td>
                <td>{a.studentName}</td>
                <td>
                  {a.fromTherapistName} → {a.toTherapistName ?? <span className="text-rose-600">cancelled</span>}
                </td>
                <td className="text-xs text-slate-500">{plan.notifyMode === "whatsapp" ? "WhatsApp" : "Manual"}</td>
                <td>
                  <Badge tone={STATUS_TONE[a.parentStatus]}>{PARENT_STATUS_LABEL[a.parentStatus]}</Badge>
                  {a.parentStatus === "pending" && (
                    <div className="mt-0.5 text-xs text-slate-500">reply by {parentDeadline(a.startTime)}</div>
                  )}
                </td>
                <td className="text-right">
                  {a.parentStatus === "pending" && (
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="secondary"
                        disabled={respond.isPending}
                        onClick={() => respond.mutate({ assignmentId: a.id, response: "accepted" })}
                      >
                        Accepted
                      </Button>
                      <Button
                        variant="secondary"
                        disabled={respond.isPending}
                        onClick={() => respond.mutate({ assignmentId: a.id, response: "declined" })}
                      >
                        Declined
                      </Button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {respond.data?.replan && (
        <p className="mt-2 text-sm text-sky-700">A new draft plan was generated for the declined session — review it above.</p>
      )}
      {respond.error && <p className="mt-2 text-sm text-rose-600">{respond.error.message}</p>}
    </Card>
  );
}

/** Demo helper: the case dates are in 2031, so the real clock never reaches a deadline. */
function DeadlineCheck({ date }: { date: string }) {
  const check = useRunDeadlineCheck();
  const [time, setTime] = useState("08:20");
  return (
    <div className="flex flex-wrap items-center gap-1 text-xs">
      <span className="text-slate-500">Simulate time</span>
      <input type="time" className={inputClass} value={time} onChange={(e) => setTime(e.target.value)} aria-label="Simulated time" />
      <Button variant="secondary" onClick={() => check.mutate(`${date}T${time}:00+08:00`)} disabled={check.isPending}>
        Run deadline check
      </Button>
      {check.data && <span className="text-slate-500">{check.data.expiredAssignmentIds.length} expired</span>}
    </div>
  );
}
