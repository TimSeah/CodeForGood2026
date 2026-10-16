import { useState } from "react";
import { Link } from "react-router";
import type { GenerationMode, Plan } from "@/api/types";
import { Badge, Button, Callout, Card, DateInput, PageHeader, QueryState, Tabs, inputClass } from "@/components/ui";
import { Icon } from "@/components/icons";
import { useSelectedDate } from "@/hooks/useSelectedDate";
import { useGeneratePlan, usePlans } from "./api";
import { CalendarPreview } from "./CalendarPreview";
import { DraftPlanCard } from "./DraftPlanCard";

const cancelsIn = (p?: Plan) => p?.assignments.filter((a) => a.toTherapistId === null).length ?? 0;
const planTitle = (p: Plan) => `${p.kind === "swap_alternative" ? "Swap alternative" : p.kind === "replan" ? "Re-plan" : "Draft plan"} #${p.id}`;

/** Review the engine's tentative schedule, edit it, then approve or reject it. Parent replies live on /replies. */
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

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Step 2 of 3"
        title="Review & approve"
        actions={
          <>
            <Button
              variant="secondary"
              onClick={() =>
                generate.mutate({
                  date,
                  mode: generationMode,
                  prompt: generationMode === "agent" ? agentPrompt.trim() : undefined,
                })
              }
              disabled={generate.isPending || (generationMode === "agent" && !agentPrompt.trim())}
            >
              <Icon name="refresh" className={generate.isPending ? "animate-spin" : ""} />
              {generate.isPending
                ? generationMode === "agent" ? "Agent is drafting…" : "Running rules…"
                : generationMode === "agent" ? "Draft with AI agent" : "Re-run engine"}
            </Button>
            <DateInput value={date} onChange={setDate} />
          </>
        }
      />
      <Card
        title="Drafting method"
        subtitle="Every generated schedule remains a draft until an admin approves it."
      >
        <div className="space-y-4">
          <Tabs
            value={generationMode}
            onChange={setGenerationMode}
            label="Schedule drafting method"
            tabs={[
              { value: "rules", label: "Rule-based logic" },
              { value: "agent", label: "AI scheduling agent" },
            ]}
          />
          <p className="text-sm text-muted">
            {generationMode === "rules"
              ? "Uses deterministic team, tier, history, availability, and distance ranking."
              : "Starts from the safe rule-based draft, then applies your instruction through the same validated scheduling tools."}
          </p>
          {generationMode === "agent" && (
            <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-ink-soft">
              Instruction for the agent
              <textarea
                value={agentPrompt}
                onChange={(event) => setAgentPrompt(event.target.value)}
                maxLength={2000}
                rows={3}
                placeholder="Example: Kid A is not compatible with substitute Therapist B. Find the safest available alternative without creating conflicts."
                className={`${inputClass} min-h-24 w-full resize-y py-2 font-normal`}
              />
            </label>
          )}
        </div>
      </Card>
      {generate.error && <Callout tone="danger">{generate.error.message}</Callout>}
      <QueryState isLoading={isLoading} error={error} />

      {!isLoading && !main && (
        <Card>
          <p className="text-sm text-muted">
            No draft plan for this date. Plans are generated automatically when absences come in, or choose a drafting method and run it above.
          </p>
        </Card>
      )}

      {main && swap && (
        <div role="radiogroup" aria-label="Which plan" className="grid gap-3 md:grid-cols-2">
          {[
            { key: "main" as const, plan: main, note: "The engine’s first choice for each session." },
            { key: "swap" as const, plan: swap, note: "Moves some therapists around so fewer sessions are cancelled." },
          ].map(({ key, plan, note }) => {
            const selected = shown === plan;
            const cancels = cancelsIn(plan);
            return (
              <button
                key={key}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setVariant(key)}
                className={`flex cursor-pointer items-start gap-3.5 rounded-2xl bg-white p-4 text-left ${selected ? "border-2 border-brand" : "border border-field p-[17px] hover:bg-subtle"}`}
              >
                <span
                  className={`mt-0.5 size-5 shrink-0 rounded-full ${selected ? "border-[6px] border-brand" : "border-2 border-[#9AA39F]"}`}
                  aria-hidden="true"
                />
                <span className="flex flex-col gap-1.5">
                  <span className="text-base font-extrabold">{planTitle(plan)}</span>
                  <span className="flex flex-wrap gap-1.5">
                    <Badge tone="success">{plan.assignments.length - cancels} covered</Badge>
                    <Badge tone={cancels ? "danger" : "neutral"}>{cancels} cancelled</Badge>
                    {key === "swap" && cancels < cancelsIn(main) && <Badge tone="info">Fewer cancellations</Badge>}
                  </span>
                  <span className="text-[13px] text-muted">{note}</span>
                </span>
              </button>
            );
          })}
        </div>
      )}

      {shown && (
        <>
          <DraftPlanCard key={shown.id} plan={shown} title={planTitle(shown)} />
          <CalendarPreview key={`cal-${shown.id}`} plan={shown} />
        </>
      )}

      {approved.length > 0 && (
        <Callout
          tone="success"
          action={
            <Link to={`/replies?date=${date}`} className="font-bold underline-offset-3 hover:underline">
              Track parent replies
            </Link>
          }
        >
          {approved.length} plan{approved.length === 1 ? "" : "s"} already approved for this date.
        </Callout>
      )}
    </div>
  );
}
