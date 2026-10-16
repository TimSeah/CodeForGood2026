// npm run db:migrate — applies pending migrations (getDb() also does this automatically on startup).
import { closeDb, DATABASE_PATH, getDb } from "../src/lib/db/client";

getDb();
closeDb();
console.log(`Migrations up to date: ${DATABASE_PATH}`);
