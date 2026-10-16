// npm run db:seed                 — base data (therapists, students, teams, July 2031 sessions)
// npm run db:seed -- --scenario   — plus the 11 July 2031 absences from Case-Scenario.docx
import { closeDb, getDb } from "../src/lib/db/client";
import { SCENARIO_DATE, seedBaseData, seedScenario } from "../src/lib/db/seed";

const db = getDb();
seedBaseData(db);
console.log("Seeded base data.");
if (process.argv.includes("--scenario")) {
  seedScenario(db);
  console.log(`Seeded case scenario absences for ${SCENARIO_DATE}.`);
}
closeDb();
