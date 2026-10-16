import { useState } from "react";
import { Button, Card, DateInput, QueryState, Tabs } from "@/components/ui";
import { useSelectedDate } from "@/hooks/useSelectedDate";
import { formatCaseDate } from "@/lib/format";
import { ApprovedChanges } from "./ApprovedChanges";
import { useGeneratePlan, usePlans } from "./api";
import { CalendarPreview } from "./CalendarPreview";
import { DraftPlanCard } from "./DraftPlanCard";
import { OutboxPanel } from "./OutboxPanel";

/** Review the engine's tentative schedule, edit it, approve it, then track parent replies and messages. */
export function ApprovalPage() {
  const [date, setDate] = useSelectedDate();
  const { data: plans = [], isLoading, error } = usePlans(date);
  const generate = useGeneratePlan();
  const [variant, setVariant] = useState<"main" | "swap">("main");

  const main = plans.find((p) => p.status === "draft" && p.kind !== "swap_alternative");
  const swap = plans.find((p) => p.status === "draft" && p.kind === "swap_alternative");
  const shown = variant === "swap" && swap ? swap : main;
  const approved = plans.filter((p) => p.status === "approved");
  const cancelsIn = (p?: typeof main) => p?.assignments.filter((a) => a.toTherapistId === null).length ?? 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold">Approval</h1>
          <p className="text-sm text-slate-500">{formatCaseDate(date)}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={() => generate.mutate(date)} disabled={generate.isPending}>
            {generate.isPending ? "Re-running…" : "Re-run engine"}
          </Button>
          <DateInput value={date} onChange={setDate} />
        </div>
      </div>
      {generate.error && <p className="text-sm text-rose-600">{generate.error.message}</p>}
      <QueryState isLoading={isLoading} error={error} />

      {!isLoading && !main && (
        <Card>
          <p className="text-sm text-slate-500">
            No draft plan for this date. Plans are generated automatically when absences come in, or use “Re-run engine”.
          </p>
        </Card>
      )}

      {main && swap && (
        <Tabs
          value={variant}
          onChange={setVariant}
          tabs={[
            { value: "main", label: `Main plan (${cancelsIn(main)} cancelled)` },
            { value: "swap", label: `Swap alternative (${cancelsIn(swap)} cancelled)` },
          ]}
        />
      )}
      {shown && (
        <>
          <DraftPlanCard
            key={shown.id}
            plan={shown}
            title={`${shown === swap ? "Swap alternative" : shown.kind === "replan" ? "Re-plan" : "Draft plan"} #${shown.id}`}
          />
          <CalendarPreview key={`cal-${shown.id}`} plan={shown} />
        </>
      )}

      <ApprovedChanges plans={approved} date={date} />
      {approved.length > 0 && <OutboxPanel date={date} />}
    </div>
  );
}
