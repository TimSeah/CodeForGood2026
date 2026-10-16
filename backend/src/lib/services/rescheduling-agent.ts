import { HttpError } from "@/lib/http";
import type { Plan, PlanAssignment } from "@/lib/types";
import { AgentDraft } from "./reallocation/agent-draft";
import { loadDayContext } from "./reallocation/context";
import { applyAgentDraft, generatePlanForDate } from "./plans";
import { suggestFromAgentPrompt } from "./preferences";

type FunctionCall = {
  type: "function_call";
  name: string;
  arguments: string;
  call_id: string;
};

interface OpenAIResponse {
  id: string;
  output?: Array<FunctionCall | { type: string }>;
}

const TOOLS = [
  {
    type: "function",
    name: "read_draft",
    description: "Read every affected session and the current replacement in the draft schedule.",
    parameters: { type: "object", properties: {}, required: [], additionalProperties: false },
    strict: true,
  },
  {
    type: "function",
    name: "list_candidates",
    description: "List ranked therapists for an assignment, including current availability and why someone is unavailable.",
    parameters: {
      type: "object",
      properties: { assignmentId: { type: "integer", description: "Assignment id from read_draft." } },
      required: ["assignmentId"],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    type: "function",
    name: "set_assignment",
    description: "Change one replacement in the working draft. Use null only when the session must be cancelled.",
    parameters: {
      type: "object",
      properties: {
        assignmentId: { type: "integer", description: "Assignment id from read_draft." },
        therapistId: { type: ["integer", "null"], description: "An available therapist id from list_candidates, or null." },
        reason: { type: "string", description: "Concise human-readable reason for this choice." },
      },
      required: ["assignmentId", "therapistId", "reason"],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    type: "function",
    name: "finish_plan",
    description: "Validate the complete working draft. Call only after the admin's request has been addressed.",
    parameters: { type: "object", properties: {}, required: [], additionalProperties: false },
    strict: true,
  },
] as const;

const INSTRUCTIONS = `You are the Autism Partnership scheduling agent. You edit an already valid, rule-based draft.
Use only the supplied tools and finish with finish_plan. First inspect the draft, then obey the admin's request.
Before assigning a therapist, call list_candidates for that assignment and choose only an available option.
Never assign an absent, rostered-off, parent-declined, or already-booked therapist. Avoid cancellations where possible.
Admin-confirmed preferences are already applied: "never" rules make a therapist unavailable, and candidates marked
avoided=true break an "avoid" rule — choose them only if no other available therapist fits, and say so in the reason.
Then prefer, in order: the child's team, plan-tier fit, prior cover history, any therapist, then blacklisted therapists.
Your changes apply to this draft only. Never claim to have saved a lasting rule; the admin confirms rules separately.
The validator is authoritative. If finish_plan reports an error, repair the draft and validate again.
Every set_assignment reason must explain the choice in plain language for the approving supervisor.`;

function parseArguments(call: FunctionCall): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(call.arguments);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Arguments must be an object");
    return parsed as Record<string, unknown>;
  } catch (error) {
    throw new Error(`Invalid arguments for ${call.name}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function integerArg(args: Record<string, unknown>, name: string): number {
  const value = args[name];
  if (!Number.isInteger(value) || Number(value) <= 0) throw new Error(`${name} must be a positive integer`);
  return Number(value);
}

async function createResponse(
  apiKey: string,
  input: unknown,
  previousResponseId?: string,
  forceRead = false,
): Promise<OpenAIResponse> {
  let response: Response;
  try {
    response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL ?? "gpt-5-mini",
        instructions: INSTRUCTIONS,
        input,
        tools: TOOLS,
        tool_choice: forceRead ? { type: "function", name: "read_draft" } : "required",
        parallel_tool_calls: false,
        ...(previousResponseId ? { previous_response_id: previousResponseId } : {}),
      }),
      signal: AbortSignal.timeout(45_000),
    });
  } catch (error) {
    throw new HttpError(502, `OpenAI request failed: ${error instanceof Error ? error.message : String(error)}`);
  }
  const json = (await response.json().catch(() => null)) as (OpenAIResponse & { error?: { message?: string } }) | null;
  if (!response.ok || !json) {
    throw new HttpError(502, `OpenAI request failed: ${json?.error?.message ?? response.statusText}`);
  }
  return json;
}

async function runTool(call: FunctionCall, draft: AgentDraft) {
  const args = parseArguments(call);
  switch (call.name) {
    case "read_draft":
      return draft.summary();
    case "list_candidates":
      return draft.candidates(integerArg(args, "assignmentId"));
    case "set_assignment": {
      const assignmentId = integerArg(args, "assignmentId");
      const therapistId = args.therapistId === null ? null : integerArg(args, "therapistId");
      if (typeof args.reason !== "string" || !args.reason.trim()) throw new Error("reason is required");
      return draft.setAssignment(assignmentId, therapistId, args.reason);
    }
    case "finish_plan":
      return draft.finish();
    default:
      throw new Error(`Unknown tool ${call.name}`);
  }
}

async function refineWithOpenAI(plan: Plan, prompt: string): Promise<PlanAssignment[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new HttpError(503, "AI agent is not configured. Set OPENAI_API_KEY on the backend.");

  const draft = new AgentDraft(plan, loadDayContext(plan.date));
  let response = await createResponse(
    apiKey,
    `Admin request for ${plan.date}: ${prompt}\nInspect the draft and produce a safe alternative schedule.`,
    undefined,
    true,
  );

  for (let turn = 0; turn < 20; turn += 1) {
    const calls = (response.output ?? []).filter((item): item is FunctionCall => item.type === "function_call");
    if (calls.length === 0) throw new HttpError(502, "The AI agent stopped before validating the schedule.");

    const outputs: Array<{ type: "function_call_output"; call_id: string; output: string }> = [];
    for (const call of calls) {
      try {
        const result = await runTool(call, draft);
        if (call.name === "finish_plan" && "valid" in result && result.valid) return result.assignments;
        outputs.push({ type: "function_call_output", call_id: call.call_id, output: JSON.stringify(result) });
      } catch (error) {
        outputs.push({
          type: "function_call_output",
          call_id: call.call_id,
          output: JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
        });
      }
    }
    response = await createResponse(apiKey, outputs, response.id);
  }
  throw new HttpError(502, "The AI agent could not produce a valid schedule within 20 tool steps.");
}

/** Generates the usual safe baseline, then lets the agent revise it through the shared scheduling tools. */
export async function generateAgentPlanForDate(date: string, prompt: string, requestedBy: string): Promise<Plan | null> {
  // If the instruction sounds like a lasting rule ("never…", "from now on…"), ask the admin to confirm it as a
  // preference. It is only a SUGGESTION — it does not affect any schedule until the admin confirms it.
  suggestFromAgentPrompt(prompt, requestedBy);
  if (!process.env.OPENAI_API_KEY) {
    throw new HttpError(503, "AI agent is not configured. Set OPENAI_API_KEY on the backend.");
  }
  const plan = generatePlanForDate(date, "ai-agent");
  if (!plan) return null;
  const assignments = await refineWithOpenAI(plan, prompt);
  return applyAgentDraft(plan.id, assignments, prompt, requestedBy);
}
