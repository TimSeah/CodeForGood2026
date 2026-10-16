ALTER TABLE notifications ADD COLUMN template_vars TEXT NOT NULL DEFAULT '[]';
ALTER TABLE notifications ADD COLUMN message_id TEXT;
ALTER TABLE notifications ADD COLUMN delivery_status TEXT;
ALTER TABLE notifications ADD COLUMN delivery_error TEXT;
CREATE UNIQUE INDEX idx_notifications_message_id ON notifications(message_id);

CREATE TABLE whatsapp_inbound_responses (
  message_id TEXT PRIMARY KEY,
  assignment_id INTEGER NOT NULL REFERENCES plan_assignments(id),
  response TEXT NOT NULL CHECK (response IN ('accepted', 'declined')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
