import { createNotification } from "@/lib/repositories/notifications";
import { logAudit } from "@/lib/repositories/audit";
import { getTherapistPhone } from "@/lib/repositories/therapists";
import type { Notification } from "@/lib/types";

export interface OutboundMessage {
  recipientType: Notification["recipientType"];
  recipientId: number | null;
  toPhone: string | null;
  purpose: "parent_confirm" | "parent_cancelled" | "parent_call_centre" | "therapist_cover" | "therapist_stand_down" | "therapist_confirmed";
  body: string;
  /** Path of a file to attach, e.g. /api/session-logs/12/pdf */
  attachment?: string | null;
  planAssignmentId: number | null;
  variables: string[];
}

export interface WhatsAppGateway {
  send(message: OutboundMessage): void;
}

export function therapistPhone(id: number | null): string | null {
  return getTherapistPhone(id);
}

/** Persist inside the caller's transaction; the bot polls and delivers only after commit. */
export const outboxGateway: WhatsAppGateway = {
  send(m) {
    const connected = Boolean(process.env.BOT_SHARED_SECRET);
    const missingCentre = m.variables.includes("[centre phone]");
    const status = !connected ? "placeholder" : m.toPhone && !missingCentre ? "pending" : "failed";
    const deliveryError = connected ? !m.toPhone ? "No recipient phone configured" :
      missingCentre ? "Set CENTRE_PHONE before sending this notice" : null : null;
    const id = createNotification({ ...m, attachment: m.attachment ?? null, status, deliveryStatus: null, deliveryError, messageId: null });
    logAudit({ actor: "system", action: `notification.${status}`, entityType: "notification", entityId: id,
      details: { purpose: m.purpose, deliveryError } });
  },
};

export function getWhatsAppGateway(): WhatsAppGateway {
  return outboxGateway;
}
