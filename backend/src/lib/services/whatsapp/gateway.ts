import { createNotification } from "@/lib/repositories/notifications";
import type { Notification } from "@/lib/types";

// Outbound WhatsApp messages go through this interface so the bot integration can be swapped in later.
//
// TODO(bot-integration): the bot in /bot (repo root) only replies to inbound messages today and has no HTTP API
// besides /webhook. When the bot team adds a send endpoint, implement `HttpBotGateway` below and enable it with
// BOT_API_URL. Proactive messages (outside the 24h window) need pre-approved Meta templates, and the PDF needs
// a media upload. Parent replies should be POSTed back to /api/whatsapp/responses.

export interface OutboundMessage {
  recipientType: Notification["recipientType"];
  recipientId: number | null;
  toPhone: string | null;
  purpose: "parent_confirm" | "parent_cancelled" | "parent_call_centre" | "therapist_cover" | "therapist_stand_down" | "therapist_confirmed";
  body: string;
  /** Path of a file to attach, e.g. /api/session-logs/12/pdf */
  attachment?: string | null;
  planAssignmentId: number | null;
}

export interface WhatsAppGateway {
  send(message: OutboundMessage): void;
}

/** Records every message in the `notifications` outbox (shown on the Approval page) instead of sending it. */
export const placeholderGateway: WhatsAppGateway = {
  send(m) {
    createNotification({ ...m, attachment: m.attachment ?? null, status: "placeholder" });
    console.info(`[whatsapp:placeholder] → ${m.recipientType} ${m.toPhone ?? "(no phone)"} [${m.purpose}] ${m.body.split("\n")[0]}`);
  },
};

// TODO(bot-integration): replace with a real implementation, e.g.
//   fetch(`${process.env.BOT_API_URL}/messages`, { method: "POST", body: JSON.stringify(m) })
// and record the result in `notifications` with status "sent" or "failed". The call must not block approval
// for long: queue the sends or fire them after the DB transaction commits.
export function getWhatsAppGateway(): WhatsAppGateway {
  return placeholderGateway;
}
