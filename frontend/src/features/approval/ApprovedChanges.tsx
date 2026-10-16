import { useState } from "react";
import { Link } from "react-router";
import type { ParentStatus, Plan } from "@/api/types";
import { Badge, Button, Callout, Card, inputClass } from "@/components/ui";
import { Icon } from "@/components/icons";
import { formatTime, PARENT_STATUS_LABEL, parentDeadline } from "@/lib/format";
import { useParentResponse, useRunDeadlineCheck } from "./api";

const STATUS_TONE: Record<ParentStatus, "success" | "warning" | "danger" | "neutral"> = {
  pending: "warning",
  accepted: "success",
  declined: "danger",
  expired: "danger",
  not_required: "neutral",
};

const GRID = "md:grid md:grid-cols-[96px_minmax(100px,1fr)_minmax(170px,1.4fr)_minmax(150px,1fr)_220px] md:items-center md:gap-4";

/** Approved changes and the parents' answers. In manual mode (or after a phone call) the admin records them here. */
export function ApprovedChanges({ plans, date }: { plans: Plan[]; date: string }) {
  const respond = useParentResponse();
  const rows = plans.flatMap((p) => p.assignments.map((a) => ({ a, plan: p })));
  if (rows.length === 0) return null;
  const waiting = rows.filter(({ a }) => a.parentStatus === "pending").length;

  return (
    <Card title="Approved changes" actions={waiting > 0 && <Badge tone="warning">{waiting} waiting</Badge>} flush>
      {respond.data?.replan && (
        <div className="px-5 pt-4">
          <Callout
            tone="info"
            action={
              <Link to={`/approval?date=${date}`} className="font-bold underline-offset-3 hover:underline">
                Review it
              </Link>
            }
          >
            A new draft plan was generated for the declined session.
          </Callout>
        </div>
      )}
      <div className={`mt-4 hidden bg-subtle px-5 py-2.5 text-xs font-bold tracking-wide text-muted uppercase ${GRID}`}>
        <span>Time</span>
        <span>Child</span>
        <span>Change</span>
        <span>Parent</span>
        <span className="text-right">Record reply</span>
      </div>
      <ul>
        {rows.map(({ a, plan }) => (
          <li key={a.id} className={`flex flex-col gap-2 border-t border-line-soft px-5 py-3.5 ${GRID}`}>
            <div>
              <div className="font-bold">{formatTime(a.startTime)}</div>
              <div className="text-xs text-muted">{plan.notifyMode === "whatsapp" ? "WhatsApp" : "Manual"}</div>
            </div>
            <div className="font-bold">{a.studentName}</div>
            <div className="text-sm">
              {a.fromTherapistName} →{" "}
              {a.toTherapistName ? <strong>{a.toTherapistName}</strong> : <strong className="text-bad">cancelled</strong>}
              {a.chainId && (
                <span className="ml-1.5">
                  <Badge tone="info">swap</Badge>
                </span>
              )}
            </div>
            <div>
              <Badge tone={STATUS_TONE[a.parentStatus]}>{PARENT_STATUS_LABEL[a.parentStatus]}</Badge>
              {a.parentStatus === "pending" && (
                <div className="mt-1 text-xs font-semibold text-warn">Reply by {parentDeadline(a.startTime)}</div>
              )}
            </div>
            <div className="flex gap-1.5 md:justify-end">
              {a.parentStatus === "pending" && (
                <>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={respond.isPending}
                    onClick={() => respond.mutate({ assignmentId: a.id, response: "accepted" })}
                  >
                    <Icon name="check" size={16} className="text-good" strokeWidth={2.5} />
                    Accepted
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={respond.isPending}
                    onClick={() => respond.mutate({ assignmentId: a.id, response: "declined" })}
                  >
                    <Icon name="x" size={16} className="text-bad" strokeWidth={2.5} />
                    Declined
                  </Button>
                </>
              )}
            </div>
          </li>
        ))}
      </ul>
      {respond.error && <p className="px-5 pb-2 text-sm font-semibold text-bad">{respond.error.message}</p>}
      <DeadlineCheck date={date} />
    </Card>
  );
}

/** Demo helper: the case dates are in 2031, so the real clock never reaches a deadline. */
function DeadlineCheck({ date }: { date: string }) {
  const check = useRunDeadlineCheck();
  const [time, setTime] = useState("08:20");
  return (
    <div className="m-5 flex flex-wrap items-center gap-2.5 rounded-xl border border-dashed border-[#C9C6BB] px-4 py-3.5">
      <div className="flex-[1_1_220px]">
        <div className="text-[13px] font-bold">Demo: simulate the clock</div>
        <div className="text-xs text-muted">The case dates are in 2031, so real time never reaches a deadline.</div>
      </div>
      <input type="time" className={inputClass} value={time} onChange={(e) => setTime(e.target.value)} aria-label="Simulated time" />
      <Button variant="secondary" onClick={() => check.mutate(`${date}T${time}:00+08:00`)} disabled={check.isPending}>
        Run deadline check
      </Button>
      {check.data && <span className="text-sm text-muted">{check.data.expiredAssignmentIds.length} expired</span>}
      {check.error && <span className="text-sm font-semibold text-bad">{check.error.message}</span>}
    </div>
  );
}
