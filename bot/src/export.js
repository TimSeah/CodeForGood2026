import { existsSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

const path = process.env.DB_PATH ?? 'absences.sqlite';
if (!existsSync(path)) throw new Error(`No absence database at ${path}`);
const db = new DatabaseSync(path, { readOnly: true });
try {
  const rows = db.prepare(`SELECT id, role, name, phone, start_date, end_date, day_part,
    mc_media_id IS NOT NULL AS mc_attached, status, created_at FROM absences ORDER BY id`).all();
  const failedReplies = db.prepare('SELECT id, to_phone, inbound_id, attempts, failed_at FROM outbound WHERE failed_at IS NOT NULL ORDER BY id').all();
  console.log(JSON.stringify({ absences: rows, failedReplies }, null, 2));
} finally {
  db.close();
}
