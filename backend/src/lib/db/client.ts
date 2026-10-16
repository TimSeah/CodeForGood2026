import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { runMigrations } from "./migrate";

export const DATABASE_PATH = path.resolve(
  /*turbopackIgnore: true*/ process.cwd(),
  process.env.DATABASE_PATH ?? "data/app.db",
);

// Cache on globalThis so Next.js hot reloads don't open a new connection on every edit.
const globalForDb = globalThis as unknown as { __db?: Database.Database };

/** The single SQLite connection. Only repositories (src/lib/repositories) should call this. */
export function getDb(): Database.Database {
  if (!globalForDb.__db) {
    fs.mkdirSync(path.dirname(DATABASE_PATH), { recursive: true });
    const db = new Database(DATABASE_PATH);
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
    runMigrations(db);
    globalForDb.__db = db;
  }
  return globalForDb.__db;
}

export function closeDb() {
  globalForDb.__db?.close();
  globalForDb.__db = undefined;
}
