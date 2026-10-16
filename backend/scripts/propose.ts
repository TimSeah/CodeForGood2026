// npm run propose -- 2031-07-11 — runs the engine for a date and prints the proposals (handy when tuning scoring).
import { closeDb } from "../src/lib/db/client";
import { SCENARIO_DATE } from "../src/lib/db/seed";
import { proposeForDate } from "../src/lib/services/reallocation";

const date = process.argv[2] ?? SCENARIO_DATE;
console.table(
  proposeForDate(date, "cli").map((r) => ({
    slot: r.slot,
    student: r.studentName,
    from: r.fromTherapistName,
    to: r.toTherapistName ?? "CANCEL",
    score: r.score,
    why: r.rationale.join("; "),
  })),
);
closeDb();
