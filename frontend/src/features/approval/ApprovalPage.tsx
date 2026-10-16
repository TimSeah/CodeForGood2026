import { useState } from "react";
import type { GenerationMode } from "@/api/types";
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
  const [generationMode, setGenerationMode] = useState<GenerationMode>("rules");
  const [agentPrompt, setAgentPrompt] = useState("");

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
        <DateInput value={date} onChange={setDate} />
      </div>

      <Card title="Drafting method">
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Schedule drafting method">
            <button
              type="button"
              aria-pressed={generationMode === "rules"}
              onClick={() => setGenerationMode("rules")}
              className={`rounded-md border px-3 py-2 text-left text-sm ${generationMode === "rules" ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"}`}
            >
              <span className="block font-medium">Rule-based logic</span>
              <span className={`block text-xs ${generationMode === "rules" ? "text-slate-200" : "text-slate-500"}`}>Deterministic team, tier, history and distance ranking</span>
            </button>
            <button
              type="button"
              aria-pressed={generationMode === "agent"}
              onClick={() => setGenerationMode("agent")}
              className={`rounded-md border px-3 py-2 text-left text-sm ${generationMode === "agent" ? "border-sky-700 bg-sky-700 text-white" : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"}`}
            >
              <span className="block font-medium">AI scheduling agent</span>
              <span className={`block text-xs ${generationMode === "agent" ? "text-sky-100" : "text-slate-500"}`}>Uses your instruction and the same validated scheduling tools</span>
            </button>
          </div>

          {generationMode === "agent" && (
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Instruction for the agent</span>
              <textarea
                value={agentPrompt}
                onChange={(event) => setAgentPrompt(event.target.value)}
                maxLength={2000}
                rows={3}
                placeholder="Example: Kid A is not compatible with substitute Therapist B. Find the safest available alternative without creating conflicts."
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200"
              />
            </label>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <Button
              onClick={() => generate.mutate({
                date,
                mode: generationMode,
                prompt: generationMode === "agent" ? agentPrompt.trim() : undefined,
              })}
              disabled={generate.isPending || (generationMode === "agent" && !agentPrompt.trim())}
            >
              {generate.isPending
                ? generationMode === "agent" ? "Agent is drafting…" : "Running rules…"
                : generationMode === "agent" ? "Draft with AI agent" : "Re-run rule engine"}
            </Button>
            <p className="text-xs text-slate-500">Every generated plan remains a draft until an admin approves it.</p>
          </div>
        </div>
      </Card>
      {generate.error && <p className="text-sm text-rose-600">{generate.error.message}</p>}
      <QueryState isLoading={isLoading} error={error} />

      {!isLoading && !main && (
        <Card>
          <p className="text-sm text-slate-500">
            No draft plan for this date. Plans are generated automatically when absences come in, or choose a drafting method above.
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
