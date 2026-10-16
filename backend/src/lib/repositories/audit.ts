import { getDb } from "@/lib/db/client";
import type { AuditEntry } from "@/lib/types";

/** Record a state change. Call this from services for every create/update/decision. */
export function logAudit(entry: {
  actor: string;
  action: string; // e.g. "absence.created", "reallocation.approved"
  entityType: string;
  entityId?: number | null;
  details?: unknown;
}) {
  getDb()
    .prepare("INSERT INTO audit_log (actor, action, entity_type, entity_id, details) VALUES (?, ?, ?, ?, ?)")
    .run(
      entry.actor,
      entry.action,
      entry.entityType,
      entry.entityId ?? null,
      entry.details === undefined ? null : JSON.stringify(entry.details),
    );
}

export function listAudit(limit: number): AuditEntry[] {
  const rows = getDb().prepare("SELECT * FROM audit_log ORDER BY id DESC LIMIT ?").all(limit) as {
    id: number;
    actor: string;
    action: string;
    entity_type: string;
    entity_id: number | null;
    details: string | null;
    created_at: string;
  }[];
  return rows.map((r) => ({
    id: r.id,
    actor: r.actor,
    action: r.action,
    entityType: r.entity_type,
    entityId: r.entity_id,
    details: r.details ? JSON.parse(r.details) : null,
    createdAt: r.created_at,
  }));
}
