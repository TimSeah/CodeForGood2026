import { getDb } from "@/lib/db/client";
import type { ParentResponse } from "@/lib/types";

export function getInboundResponse(messageId: string): { assignmentId: number; response: ParentResponse } | null {
  const row = getDb().prepare("SELECT assignment_id, response FROM whatsapp_inbound_responses WHERE message_id = ?")
    .get(messageId) as { assignment_id: number; response: ParentResponse } | undefined;
  return row ? { assignmentId: row.assignment_id, response: row.response } : null;
}

export function saveInboundResponse(messageId: string, assignmentId: number, response: ParentResponse) {
  getDb().prepare("INSERT INTO whatsapp_inbound_responses (message_id, assignment_id, response) VALUES (?, ?, ?)")
    .run(messageId, assignmentId, response);
}
