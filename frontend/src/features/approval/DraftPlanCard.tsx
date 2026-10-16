import { useState } from "react";
import type { NotifyMode, Plan } from "@/api/types";
import { Badge, Button, Card, Modal } from "@/components/ui";
import { AssignmentRow } from "./AssignmentRow";
import { useApprovePlan, useRejectPlan } from "./api";

/** A tentative schedule waiting for the admin: review, edit, then approve or reject. */
export function DraftPlanCard({ plan, title }: { plan: Plan; title: string }) {
  const [confirming, setConfirming] = useState(false);
  const approve = useApprovePlan();
  const reject = useRejectPlan();
  const errors = plan.issues.filter((i) => i.level === "error");
  const general = plan.issues.filter((i) => i.assignmentId === undefined);
  const cancels = plan.assignments.filter((a) => a.toTherapistId === null).length;

  const doApprove = (notifyMode: NotifyMode) =>
    approve.mutate({ planId: plan.id, notifyMode }, { onSuccess: () => setConfirming(false) });

  return (
    <Card
      title={title}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="neutral">{plan.assignments.length - cancels} reassigned</Badge>
          <Badge tone={cancels ? "danger" : "neutral"}>{cancels} cancelled</Badge>
          <Button variant="secondary" onClick={() => reject.mutate(plan.id)} disabled={reject.isPending}>
            Reject
          </Button>
          <Button onClick={() => setConfirming(true)} disabled={errors.length > 0} title={errors.length ? "Fix the errors first" : ""}>
            Approve…
          </Button>
        </div>
      }
    >
      {errors.length > 0 && (
        <p className="mb-3 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {errors.length} error(s) must be fixed before this plan can be approved.
        </p>
      )}
      {general.map((i) => (
        <p key={i.message} className="mb-2 text-sm text-rose-700">
          ✖ {i.message}
        </p>
      ))}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="text-xs text-slate-500">
            <tr>
              <th className="py-2">Slot</th>
              <th>Child</th>
              <th>Usual therapist</th>
              <th>Replacement</th>
              <th>Why</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {plan.assignments.map((a) => (
              <AssignmentRow key={a.id} a={a} editable issues={plan.issues.filter((i) => i.assignmentId === a.id)} />
            ))}
          </tbody>
        </table>
      </div>
      {(approve.error || reject.error) && <p className="mt-2 text-sm text-rose-600">{(approve.error ?? reject.error)!.message}</p>}

      {confirming && (
        <Modal title="Approve this plan" onClose={() => setConfirming(false)}>
          <p className="text-sm text-slate-700">
            The schedule will be updated now. Do you want automated WhatsApp messages sent to the parents and therapists?
          </p>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-600">
            <li>Parents are asked to reply YES/NO. No reply by 15 minutes before the session → it's cancelled.</li>
            <li>Substitute therapists get a summary of the child's last session, with that session's log as a PDF.</li>
            <li>If you choose not to send, record each parent's answer on this page yourself.</li>
          </ul>
          <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
            WhatsApp sending isn't connected yet: messages are saved to the outbox below instead of being sent.
          </p>
          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <Button variant="secondary" onClick={() => doApprove("manual")} disabled={approve.isPending}>
              No, I'll contact them
            </Button>
            <Button onClick={() => doApprove("whatsapp")} disabled={approve.isPending}>
              Yes, send WhatsApp messages
            </Button>
          </div>
        </Modal>
      )}
    </Card>
  );
}
