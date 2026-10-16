// npm run propose -- 2031-07-11 — re-runs the engine for a date and prints the draft (handy when tuning rules).
import { closeDb } from "../src/lib/db/client";
import { SCENARIO_DATE } from "../src/lib/services/demo-scenario";
import { generatePlanForDate, listPlans } from "../src/lib/services/plans";

const date = process.argv[2] ?? SCENARIO_DATE;
generatePlanForDate(date, "cli");
const drafts = listPlans(date).filter((p) => p.status === "draft");
if (!drafts.length) console.log(`Nothing needs cover on ${date}.`);
for (const plan of drafts) {
  console.log(`\nPlan #${plan.id} (${plan.kind}) — ${plan.issues.filter((i) => i.level === "error").length} error(s)`);
  console.table(
    plan.assignments.map((a) => ({
      slot: a.slot,
      child: `${a.studentName} (${a.studentPlan})`,
      from: a.fromTherapistName,
      to: a.toTherapistName ?? "CANCEL",
      step: a.step,
      km: a.distanceKm,
      why: a.rationale.join("; "),
    })),
  );
}
closeDb();
