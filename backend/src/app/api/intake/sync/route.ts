import { handle, ok } from "@/lib/http";
import { syncFromBot } from "@/lib/services/intake";
import { actorBody } from "@/lib/validation/schemas";

// POST /api/intake/sync — pull new reports from the WhatsApp bot's SQLite DB (BOT_DB_PATH) and ingest them.
// The Disruptions page calls this every 30 s. Returns { available: false } if the bot DB doesn't exist.
export const POST = handle(async (req: Request) => {
  const { actor } = actorBody.parse(await req.json().catch(() => ({})));
  return ok(syncFromBot(actor));
});
