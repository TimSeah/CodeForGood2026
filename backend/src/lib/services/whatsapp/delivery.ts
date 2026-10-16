import { getDb } from "@/lib/db/client";
import { HttpError } from "@/lib/http";
import { logAudit } from "@/lib/repositories/audit";
import { updateNotificationDelivery } from "@/lib/repositories/notifications";

export function recordNotificationDelivery(id: number, status: "sent" | "delivered" | "read" | "failed", messageId: string | null, error: string | null) {
  const state = getDb().transaction(() => {
    const result = updateNotificationDelivery(id, status, messageId, error);
    if (result === "changed") {
      logAudit({ actor: "whatsapp", action: `notification.${status}`, entityType: "notification", entityId: id, details: { messageId, error } });
    }
    return result;
  })();
  if (state === "missing") throw new HttpError(404, "Notification not found or message ID mismatch");
  return { status: state };
}
