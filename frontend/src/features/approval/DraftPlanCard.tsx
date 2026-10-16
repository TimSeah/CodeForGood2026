import { useState } from "react";
import type { NotifyMode, Plan, Slot } from "@/api/types";
import { Badge, Button, Callout, Modal } from "@/components/ui";
import { Icon } from "@/components/icons";
import { AssignmentRow, ROW_GRID } from "./AssignmentRow";
import { useApprovePlan, useRejectPlan } from "./api";

const SLOT_LABEL: Record<Slot, string> = { AM: "Morning", PM: "Afternoon" };

/** A tentative schedule waiting for the admin: review, edit, then approve or reject. */
export function DraftPlanCard({ plan, title }: { plan: Plan; title: string }) {
  const [confirming, setConfirming] = useState(false);
  const approve = useApprovePlan();
  const reject = useRejectPlan();
  const errors = plan.issues.filter((i) => i.level === "error");
  const general = plan.issues.filter((i) => i.assignmentId === undefined);
  const cancels = plan.assignments.filter((a) => a.toTherapistId === null).length;
  const firstError = errors.find((i) => i.assignmentId !== undefined);

  const doApprove = (notifyMode: NotifyMode) =>
    approve.mutate({ planId: plan.id, notifyMode }, { onSuccess: () => setConfirming(false) });

  return (
    <>
      {errors.length > 0 && (
        <Callout
          tone="danger"
          action={
            firstError && (
              <a href={`#assignment-${firstError.assignmentId}`} className="font-bold underline-offset-3 hover:underline">
                Show me
              </a>
            )
          }
        >
          {errors.length} error{errors.length === 1 ? "" : "s"} must be fixed before this plan can be approved.
        </Callout>
      )}
      {general.map((i) => (
        <Callout key={i.message} tone={i.level === "error" ? "danger" : "warning"}>
          {i.message}
        </Callout>
      ))}

      <section className="overflow-hidden rounded-2xl border border-line bg-white" aria-label={title}>
        <div className={`hidden bg-subtle px-5 py-3 text-xs font-bold tracking-wide text-muted uppercase ${ROW_GRID}`}>
          <span>Time</span>
          <span>Child</span>
          <span>Who covers</span>
          <span>Why this choice</span>
          <span className="text-right">Actions</span>
        </div>
        {(["AM", "PM"] as const).map((slot) => {
          const rows = plan.assignments.filter((a) => a.slot === slot);
          if (rows.length === 0) return null;
          return (
            <div key={slot}>
              <div className="border-t border-line-soft bg-paper px-5 py-2.5 text-[13px] font-extrabold text-ink-soft">
                {SLOT_LABEL[slot]} · {rows.length} change{rows.length === 1 ? "" : "s"}
              </div>
              {rows.map((a) => (
                <AssignmentRow key={a.id} a={a} editable issues={plan.issues.filter((i) => i.assignmentId === a.id)} />
              ))}
            </div>
          );
        })}
      </section>

      <div className="sticky bottom-0 z-10 -mx-4 flex flex-wrap items-center gap-3 border-t border-line bg-white/95 px-4 py-4 shadow-[0_-6px_20px_rgba(27,36,34,0.06)] backdrop-blur sm:-mx-8 sm:px-8 lg:-mx-10 lg:px-10">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <strong>{title}</strong>
          <Badge tone="success">{plan.assignments.length - cancels} reassigned</Badge>
          <Badge tone={cancels ? "danger" : "neutral"}>{cancels} cancelled</Badge>
          {errors.length > 0 && <Badge tone="danger">{errors.length} error{errors.length === 1 ? "" : "s"}</Badge>}
        </div>
        {(approve.error || reject.error) && <p className="text-sm font-semibold text-bad">{(approve.error ?? reject.error)!.message}</p>}
        <div className="ml-auto flex gap-2">
          <Button variant="danger" onClick={() => reject.mutate(plan.id)} disabled={reject.isPending}>
            Reject plan
          </Button>
          <Button onClick={() => setConfirming(true)} disabled={errors.length > 0} title={errors.length ? "Fix the errors first" : ""}>
            <Icon name="check" />
            Approve plan…
          </Button>
        </div>
      </div>

      {confirming && (
        <Modal title={`Approve ${title}?`} onClose={() => setConfirming(false)}>
          <p className="text-sm text-ink-soft">
            {plan.assignments.length - cancels} sessions covered, {cancels} cancelled. The schedule updates right away.
          </p>
          <p className="mt-4 text-sm font-bold">Send WhatsApp messages to the parents and therapists?</p>
          <ol className="mt-3 space-y-2.5 text-sm text-ink-soft">
            {[
              <>Parents are asked to reply <strong>YES</strong> or <strong>NO</strong>. No reply by 15 minutes before the session means it’s cancelled.</>,
              <>Substitute therapists get a summary of the child’s last session, with that session’s log as a PDF.</>,
              <>If you choose not to send, record each parent’s answer on the Parent replies page yourself.</>,
            ].map((text, i) => (
              <li key={i} className="flex gap-2.5">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-sunk text-xs font-extrabold">{i + 1}</span>
                <span>{text}</span>
              </li>
            ))}
          </ol>
          <div className="mt-4">
            <Callout tone="warning">WhatsApp sending isn’t connected yet: messages are saved to the outbox instead of being sent.</Callout>
          </div>
          <div className="mt-5 flex flex-wrap justify-end gap-2">
            <Button variant="secondary" onClick={() => doApprove("manual")} disabled={approve.isPending}>
              No, I’ll contact them
            </Button>
            <Button onClick={() => doApprove("whatsapp")} disabled={approve.isPending}>
              Approve &amp; send messages
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}
