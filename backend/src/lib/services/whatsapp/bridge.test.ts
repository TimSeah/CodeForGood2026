import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

let folder: string;
let previousPath: string | undefined;
let previousSecret: string | undefined;
let previousBotPath: string | undefined;
let getDb: typeof import("@/lib/db/client").getDb;
let closeDb: typeof import("@/lib/db/client").closeDb;
let gateway: typeof import("./gateway").outboxGateway;
let outbox: typeof import("@/app/api/whatsapp/outbox/route").GET;
let delivery: typeof import("@/app/api/whatsapp/outbox/[id]/status/route").POST;
let responseRoute: typeof import("@/app/api/whatsapp/responses/route").POST;
let phoneRoute: typeof import("@/app/api/therapists/[id]/phone/route").PATCH;
let guardianRoute: typeof import("@/app/api/students/[id]/guardian-phone/route").PATCH;
let syncFromBot: typeof import("@/lib/services/intake").syncFromBot;

beforeAll(async () => {
  folder = mkdtempSync(join(tmpdir(), "whatsapp-backend-"));
  previousPath = process.env.DATABASE_PATH;
  previousSecret = process.env.BOT_SHARED_SECRET;
  previousBotPath = process.env.BOT_DB_PATH;
  process.env.DATABASE_PATH = join(folder, "backend.sqlite");
  process.env.BOT_SHARED_SECRET = "test-secret";
  process.env.BOT_DB_PATH = join(folder, "bot.sqlite");
  ({ getDb, closeDb } = await import("@/lib/db/client"));
  ({ outboxGateway: gateway } = await import("./gateway"));
  ({ GET: outbox } = await import("@/app/api/whatsapp/outbox/route"));
  ({ POST: delivery } = await import("@/app/api/whatsapp/outbox/[id]/status/route"));
  ({ POST: responseRoute } = await import("@/app/api/whatsapp/responses/route"));
  ({ PATCH: phoneRoute } = await import("@/app/api/therapists/[id]/phone/route"));
  ({ PATCH: guardianRoute } = await import("@/app/api/students/[id]/guardian-phone/route"));
  ({ syncFromBot } = await import("@/lib/services/intake"));
  getDb().exec(`
    INSERT INTO therapists (id, name, rank, phone) VALUES (1, 'Cover', 'BT', '6598765432');
    INSERT INTO students (id, name, guardian_name, guardian_phone) VALUES (1, 'Sam', 'Alex', '6591234567');
    INSERT INTO sessions (id, date, slot, start_time, end_time, student_id, therapist_id)
      VALUES (1, '2031-07-11', 'AM', '08:30', '12:00', 1, 1);
    INSERT INTO plans (id, date, status, notify_mode) VALUES (1, '2031-07-11', 'approved', 'whatsapp');
    INSERT INTO plan_assignments (id, plan_id, session_id, to_therapist_id, step)
      VALUES (32, 1, 1, 1, 'team');
  `);
});

afterAll(() => {
  closeDb();
  if (previousPath === undefined) delete process.env.DATABASE_PATH;
  else process.env.DATABASE_PATH = previousPath;
  if (previousSecret === undefined) delete process.env.BOT_SHARED_SECRET;
  else process.env.BOT_SHARED_SECRET = previousSecret;
  if (previousBotPath === undefined) delete process.env.BOT_DB_PATH;
  else process.env.BOT_DB_PATH = previousBotPath;
  rmSync(folder, { recursive: true, force: true });
});

const headers = { authorization: ["Bearer", "test-secret"].join(" "), "content-type": "application/json" };
const request = (url: string, body?: unknown, authorized = true) =>
  new Request(`http://localhost${url}`, {
    ...(body === undefined ? {} : { method: "POST", body: JSON.stringify(body) }),
    headers: authorized ? headers : {},
  });

describe("authenticated WhatsApp outbox", () => {
  it("queues committed messages, rejects anonymous polls and records Meta status monotonically", async () => {
    const db = getDb();
    db.transaction(() => gateway.send({
      recipientType: "guardian", recipientId: 1, toPhone: "6591234567", purpose: "parent_confirm",
      body: "Please reply", attachment: null, planAssignmentId: 32, variables: ["Alex", "Sam", "session", "Cover", "deadline", "32"],
    }))();
    expect((await outbox(request("/api/whatsapp/outbox", undefined, false))).status).toBe(401);
    const result = await outbox(request("/api/whatsapp/outbox"));
    expect(result.status).toBe(200);
    const { data } = await result.json();
    expect(data).toHaveLength(1);
    const id: number = data[0].id;
    expect(data[0].variables).toEqual(["Alex", "Sam", "session", "Cover", "deadline", "32"]);
    expect(data[0].body).toBe("Please reply");
    const update = (status: string, messageId: string | null = "wamid.1") =>
      delivery(request(`/api/whatsapp/outbox/${id}/status`, { status, messageId }),
        { params: Promise.resolve({ id: String(id) }) });
    expect((await update("sent")).status).toBe(200);
    expect((await update("delivered")).status).toBe(200);
    expect((await update("sent")).status).toBe(200);
    expect((await update("read")).status).toBe(200);
    expect((await update("failed")).status).toBe(200);
    expect((await update("delivered", "different-wamid")).status).toBe(404);
    const row = db.prepare("SELECT status, delivery_status, message_id FROM notifications WHERE id = ?")
      .get(id) as { status: string; delivery_status: string; message_id: string };
    expect(row).toEqual({ status: "sent", delivery_status: "read", message_id: "wamid.1" });
    await expect((await outbox(request("/api/whatsapp/outbox"))).json()).resolves.toEqual({ data: [] });
  });

  it("requires the guardian's number and deduplicates inbound replies", async () => {
    const url = "/api/whatsapp/responses";
    const answer = { messageId: "wamid.reply1", phone: "6591234567", assignmentId: 32, response: "yes" };
    expect((await responseRoute(request(url, answer, false))).status).toBe(401);
    expect((await responseRoute(request(url, { ...answer, phone: "6588888888" }))).status).toBe(404);
    const recorded = await responseRoute(request(url, answer));
    expect(recorded.status).toBe(200);
    expect(await recorded.json()).toEqual({ data: { assignmentId: 32, response: "accepted", duplicate: false } });
    const duplicate = await responseRoute(request(url, answer));
    expect(await duplicate.json()).toEqual({ data: { assignmentId: 32, response: "accepted", duplicate: true } });
    expect((getDb().prepare("SELECT parent_status FROM plan_assignments WHERE id = 32").get() as { parent_status: string }).parent_status)
      .toBe("accepted");
    expect((getDb().prepare("SELECT count(*) AS count FROM whatsapp_inbound_responses").get() as { count: number }).count).toBe(1);
  });

  it("updates a therapist's contact number for subsequent cover notices", async () => {
    const result = await phoneRoute(new Request("http://localhost/api/therapists/1/phone", {
      method: "PATCH", headers: { "content-type": "application/json" },
      body: JSON.stringify({ phone: "+6591234567", actor: "staff" }),
    }), { params: Promise.resolve({ id: "1" }) });
    expect(result.status).toBe(200);
    expect((getDb().prepare("SELECT phone FROM therapists WHERE id = 1").get() as { phone: string }).phone)
      .toBe("+6591234567");
    const guardian = await guardianRoute(new Request("http://localhost/api/students/1/guardian-phone", {
      method: "PATCH", headers: { "content-type": "application/json" },
      body: JSON.stringify({ phone: "+6591234567", actor: "staff" }),
    }), { params: Promise.resolve({ id: "1" }) });
    expect(guardian.status).toBe(200);
    expect((getDb().prepare("SELECT guardian_phone FROM students WHERE id = 1").get() as { guardian_phone: string }).guardian_phone)
      .toBe("+6591234567");
  });

  it("flags an uncontactable recipient instead of claiming to have sent a message", () => {
    gateway.send({
      recipientType: "therapist", recipientId: 1, toPhone: null, purpose: "therapist_cover",
      body: "Cover request", planAssignmentId: 32, variables: ["Cover", "Sam", "clinic", "session"],
    });
    expect(getDb().prepare("SELECT status, delivery_error FROM notifications ORDER BY id DESC LIMIT 1").get())
      .toEqual({ status: "failed", delivery_error: "No recipient phone configured" });
  });

  it("copies a bot report once from the shared SQLite file for admin review", () => {
    const bot = new DatabaseSync(process.env.BOT_DB_PATH!);
    bot.exec(`CREATE TABLE absences (
      id INTEGER PRIMARY KEY, role TEXT, name TEXT, phone TEXT, start_date TEXT,
      end_date TEXT, day_part TEXT, mc_media_id TEXT, created_at TEXT
    );
    INSERT INTO absences VALUES (1, 'therapist', 'Unknown Name', '6599999999',
      '2031-07-11', '2031-07-11', 'whole day', NULL, '2031-07-10 09:00:00');`);
    bot.close();
    expect(syncFromBot("staff").imported).toBe(1);
    expect(syncFromBot("staff").imported).toBe(0);
    expect(getDb().prepare("SELECT source_id, status FROM bot_reports WHERE source_id = 'bot:1'").get())
      .toEqual({ source_id: "bot:1", status: "unmatched" });
  });

  it("re-plans atomically when a parent declines and acknowledges webhook retries", async () => {
    getDb().exec(`
      INSERT INTO sessions (id, date, slot, start_time, end_time, student_id, therapist_id)
        VALUES (2, '2031-07-12', 'AM', '08:30', '12:00', 1, 1);
      INSERT INTO plans (id, date, status, notify_mode) VALUES (2, '2031-07-12', 'approved', 'whatsapp');
      INSERT INTO plan_assignments (id, plan_id, session_id, to_therapist_id, step)
        VALUES (33, 2, 2, 1, 'team');
    `);
    const body = { messageId: "wamid.decline1", phone: "+6591234567", assignmentId: 33, response: "no" };
    const first = await responseRoute(request("/api/whatsapp/responses", body));
    expect(first.status).toBe(200);
    const again = await responseRoute(request("/api/whatsapp/responses", body));
    expect(await again.json()).toEqual({ data: { assignmentId: 33, response: "declined", duplicate: true } });
    expect((getDb().prepare("SELECT parent_status FROM plan_assignments WHERE id = 33").get() as { parent_status: string }).parent_status)
      .toBe("declined");
    expect((getDb().prepare("SELECT count(*) AS count FROM plans WHERE date = '2031-07-12' AND status = 'draft'").get() as { count: number }).count)
      .toBe(1);
  });
});
