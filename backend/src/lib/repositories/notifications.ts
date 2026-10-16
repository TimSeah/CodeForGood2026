import { getDb } from "@/lib/db/client";
import type { Notification } from "@/lib/types";

interface NotificationRow {
  id: number;
  recipient_type: Notification["recipientType"];
  recipient_id: number | null;
  recipient_name: string | null;
  to_phone: string | null;
  purpose: string;
  body: string;
  attachment: string | null;
  status: Notification["status"];
  plan_assignment_id: number | null;
  template_vars: string;
  message_id: string | null;
  delivery_status: Notification["deliveryStatus"];
  delivery_error: string | null;
  created_at: string;
}

const toNotification = (r: NotificationRow): Notification => ({
  id: r.id,
  recipientType: r.recipient_type,
  recipientId: r.recipient_id,
  recipientName: r.recipient_name,
  toPhone: r.to_phone,
  purpose: r.purpose,
  body: r.body,
  attachment: r.attachment,
  status: r.status,
  planAssignmentId: r.plan_assignment_id,
  variables: JSON.parse(r.template_vars) as string[],
  messageId: r.message_id,
  deliveryStatus: r.delivery_status,
  deliveryError: r.delivery_error,
  createdAt: r.created_at,
});

export function createNotification(input: Omit<Notification, "id" | "createdAt" | "recipientName">): number {
  const r = getDb()
    .prepare(
      `INSERT INTO notifications (recipient_type, recipient_id, to_phone, purpose, body, attachment, status, plan_assignment_id, template_vars, delivery_status, delivery_error)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      input.recipientType,
      input.recipientId,
      input.toPhone,
      input.purpose,
      input.body,
      input.attachment,
      input.status,
      input.planAssignmentId,
      JSON.stringify(input.variables),
      input.deliveryStatus,
      input.deliveryError,
    );
  return Number(r.lastInsertRowid);
}

export function getNotification(id: number): Notification | null {
  const row = getDb().prepare("SELECT * FROM notifications WHERE id = ?").get(id) as NotificationRow | undefined;
  return row ? toNotification(row) : null;
}

export function pendingNotifications(): Notification[] {
  return (getDb().prepare("SELECT * FROM notifications WHERE status = 'pending' ORDER BY id LIMIT 50").all() as NotificationRow[])
    .map(toNotification);
}

export function updateNotificationDelivery(id: number, status: "sent" | "delivered" | "read" | "failed", messageId: string | null, error: string | null): "missing" | "unchanged" | "changed" {
  const current = getNotification(id);
  if (!current || (current.messageId && messageId && current.messageId !== messageId)) return "missing";
  const rank: Record<string, number> = { pending: 0, sent: 1, delivered: 2, read: 3, failed: 4 };
  if (current.deliveryStatus && rank[current.deliveryStatus] >= rank[status]) return "unchanged";
  if (current.status === "failed" || (status === "failed" && (current.deliveryStatus === "delivered" || current.deliveryStatus === "read"))) return "unchanged";
  getDb().prepare(
    `UPDATE notifications SET status = ?, delivery_status = ?, message_id = COALESCE(message_id, ?), delivery_error = ?
     WHERE id = ?`,
  ).run(status === "failed" ? "failed" : "sent", status, messageId, error, id);
  return "changed";
}

/** Messages about changes to sessions on `date`, newest first. */
export function listNotificationsByDate(date: string): Notification[] {
  const rows = getDb()
    .prepare(
      `SELECT n.*, CASE n.recipient_type WHEN 'therapist' THEN t.name WHEN 'guardian' THEN s.guardian_name END AS recipient_name
       FROM notifications n
       LEFT JOIN plan_assignments pa ON pa.id = n.plan_assignment_id
       LEFT JOIN sessions se ON se.id = pa.session_id
       LEFT JOIN therapists t ON n.recipient_type = 'therapist' AND t.id = n.recipient_id
       LEFT JOIN students s ON n.recipient_type = 'guardian' AND s.id = n.recipient_id
       WHERE se.date = ? ORDER BY n.id DESC`,
    )
    .all(date) as NotificationRow[];
  return rows.map(toNotification);
}
