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
  createdAt: r.created_at,
});

export function createNotification(input: Omit<Notification, "id" | "createdAt" | "recipientName">): number {
  const r = getDb()
    .prepare(
      `INSERT INTO notifications (recipient_type, recipient_id, to_phone, purpose, body, attachment, status, plan_assignment_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
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
    );
  return Number(r.lastInsertRowid);
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
