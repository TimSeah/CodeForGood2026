import { getDb } from "@/lib/db/client";
import { handle, ok } from "@/lib/http";

export const GET = handle(() => {
  getDb().prepare("SELECT 1").get();
  return ok({ status: "ok", time: new Date().toISOString() });
});
