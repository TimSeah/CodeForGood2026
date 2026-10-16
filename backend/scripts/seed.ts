// npm run db:seed                 — base data (therapists, students, teams, July 2031 sessions, past logs)
// npm run db:seed -- --scenario   — plus the 11 July 2031 disruption from Case-Scenario.docx (as WhatsApp reports)
import { closeDb, getDb } from "../src/lib/db/client";
import { seedBaseData } from "../src/lib/db/seed";
import { SCENARIO_DATE, seedScenario } from "../src/lib/services/demo-scenario";

seedBaseData(getDb());
console.log("Seeded base data.");
if (process.argv.includes("--scenario")) {
  seedScenario();
  console.log(`Seeded case scenario for ${SCENARIO_DATE} and generated a draft plan.`);
}
closeDb();
