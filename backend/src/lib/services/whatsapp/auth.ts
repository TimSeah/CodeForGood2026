import { timingSafeEqual } from "node:crypto";
import { HttpError } from "@/lib/http";

export function requireBot(req: Request) {
  const secret = process.env.BOT_SHARED_SECRET;
  if (!secret) throw new HttpError(503, "WhatsApp bot connection is not configured");
  const supplied = req.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  const expected = Buffer.from(secret);
  const actual = Buffer.from(supplied);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    throw new HttpError(401, "Invalid bot credentials");
  }
}
