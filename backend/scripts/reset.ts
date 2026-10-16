// npm run db:reset — deletes the SQLite file, re-runs migrations, seeds base data + the case scenario.
// Use this after pulling a teammate's schema change. Stop the dev server first (Windows locks the file).
import fs from "node:fs";
import { closeDb, DATABASE_PATH, getDb } from "../src/lib/db/client";
import { seedBaseData, seedScenario } from "../src/lib/db/seed";

for (const suffix of ["", "-wal", "-shm"]) fs.rmSync(DATABASE_PATH + suffix, { force: true });
const db = getDb();
seedBaseData(db);
seedScenario(db);
closeDb();
console.log(`Reset ${DATABASE_PATH} with base data + case scenario.`);
