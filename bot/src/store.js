import { DatabaseSync } from 'node:sqlite';

export class Store {
  constructor(path) {
    this.db = new DatabaseSync(path);
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS conversations (
        phone TEXT PRIMARY KEY,
        draft TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS inbound (
        id TEXT PRIMARY KEY,
        payload TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        received_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS outbound (
        id INTEGER PRIMARY KEY,
        to_phone TEXT,
        inbound_id TEXT,
        payload TEXT NOT NULL,
        sent_at TEXT,
        attempts INTEGER NOT NULL DEFAULT 0,
        next_retry_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        failed_at TEXT
      );
      CREATE TABLE IF NOT EXISTS absences (
        id INTEGER PRIMARY KEY,
        phone TEXT NOT NULL,
        role TEXT NOT NULL,
        name TEXT NOT NULL,
        start_date TEXT NOT NULL,
        end_date TEXT NOT NULL,
        day_part TEXT NOT NULL,
        mc_media_id TEXT,
        mc_sha256 TEXT,
        mc_mime TEXT,
        status TEXT NOT NULL DEFAULT 'pending_admin_review',
        inbound_id TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS audit (
        id INTEGER PRIMARY KEY,
        inbound_id TEXT NOT NULL,
        event TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS bridge_events (
        id INTEGER PRIMARY KEY,
        event_key TEXT NOT NULL UNIQUE,
        notification_id INTEGER NOT NULL,
        status TEXT NOT NULL,
        message_id TEXT,
        error TEXT
      );
      CREATE TABLE IF NOT EXISTS last_contact (
        phone TEXT PRIMARY KEY,
        last_inbound_at TEXT NOT NULL
      );
    `);
    const addColumn = (table, name, definition) => {
      if (!this.db.prepare(`PRAGMA table_info(${table})`).all().some((c) => c.name === name)) {
        this.db.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${definition}`);
      }
    };
    addColumn('inbound', 'next_retry_at', "TEXT NOT NULL DEFAULT '1970-01-01 00:00:00'");
    addColumn('outbound', 'notification_id', 'INTEGER');
    addColumn('outbound', 'assignment_id', 'INTEGER');
    addColumn('outbound', 'message_id', 'TEXT');
    this.db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_outbound_notification ON outbound(notification_id)');
    this.db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_outbound_message ON outbound(message_id)');
    this.db.exec(`INSERT INTO last_contact (phone, last_inbound_at)
      SELECT REPLACE(REPLACE(phone, '+', ''), ' ', ''), MAX(created_at) FROM absences GROUP BY phone
      ON CONFLICT(phone) DO UPDATE SET last_inbound_at = MAX(last_contact.last_inbound_at, excluded.last_inbound_at)`);
    this.db.prepare("UPDATE inbound SET status = 'pending' WHERE status = 'processing'").run();
  }

  enqueue(id, payload) {
    this.db.exec('BEGIN');
    try {
      const added = this.db.prepare('INSERT OR IGNORE INTO inbound (id, payload) VALUES (?, ?)').run(id, JSON.stringify(payload)).changes === 1;
      if (added && payload.from) {
        this.db.prepare(`INSERT INTO last_contact (phone, last_inbound_at) VALUES (?, CURRENT_TIMESTAMP)
          ON CONFLICT(phone) DO UPDATE SET last_inbound_at = CURRENT_TIMESTAMP`)
          .run(payload.from.replace(/\D/g, ''));
      }
      this.db.exec('COMMIT');
      return added;
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }

  hasOpenConversation(phone) {
    return Boolean(this.db.prepare(`SELECT 1 FROM last_contact
      WHERE phone = ? AND last_inbound_at > datetime('now', '-23 hours', '-30 minutes')`)
      .get(phone.replace(/\D/g, '')));
  }

  next() {
    const row = this.db.prepare("SELECT id, payload FROM inbound WHERE status = 'pending' AND next_retry_at <= CURRENT_TIMESTAMP ORDER BY received_at, rowid LIMIT 1").get();
    if (row) this.db.prepare("UPDATE inbound SET status = 'processing' WHERE id = ?").run(row.id);
    return row && { id: row.id, message: JSON.parse(row.payload) };
  }

  defer(id) {
    this.db.prepare("UPDATE inbound SET status = 'pending', next_retry_at = datetime('now', '+30 seconds') WHERE id = ?").run(id);
  }

  draft(phone) {
    const row = this.db.prepare('SELECT draft FROM conversations WHERE phone = ?').get(phone);
    return row ? JSON.parse(row.draft) : { stage: 'role' };
  }

  apply(id, phone, { draft, replies, intervals, submission }) {
    this.db.exec('BEGIN');
    try {
      if (draft) {
        this.db.prepare('INSERT INTO conversations (phone, draft) VALUES (?, ?) ON CONFLICT(phone) DO UPDATE SET draft = excluded.draft')
          .run(phone, JSON.stringify(draft));
      } else {
        this.db.prepare('DELETE FROM conversations WHERE phone = ?').run(phone);
      }
      if (intervals) {
        const insert = this.db.prepare(`INSERT INTO absences
          (phone, role, name, start_date, end_date, day_part, mc_media_id, mc_sha256, mc_mime, inbound_id)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
        for (const { start, end } of intervals) {
          insert.run(phone, submission.role, submission.name, start, end, submission.dayPart,
            submission.mc?.id ?? null, submission.mc?.sha256 ?? null, submission.mc?.mime ?? null, id);
        }
        this.db.prepare('INSERT INTO audit (inbound_id, event) VALUES (?, ?)').run(id, `absence_submitted:${intervals.length}`);
      }
      for (const reply of replies) {
        this.db.prepare('INSERT INTO outbound (to_phone, inbound_id, payload) VALUES (?, ?, ?)')
          .run(phone, id, JSON.stringify({ to: phone, ...reply }));
      }
      this.db.prepare("UPDATE inbound SET status = 'done', payload = '{}' WHERE id = ?").run(id);
      this.db.exec('COMMIT');
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }

  fail(id, phone) {
    this.db.exec('BEGIN');
    try {
      this.db.prepare("UPDATE inbound SET status = 'failed', payload = '{}' WHERE id = ?").run(id);
      this.db.prepare('INSERT INTO audit (inbound_id, event) VALUES (?, ?)').run(id, 'intake_failed');
      this.db.prepare('INSERT INTO outbound (to_phone, inbound_id, payload) VALUES (?, ?, ?)').run(phone, id, JSON.stringify({
        to: phone, type: 'text', text: { body: 'We could not process your report. Please try again or contact admin directly.' },
      }));
      this.db.exec('COMMIT');
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }

  unsent() {
    return this.db.prepare(`SELECT id, payload, notification_id FROM outbound
      WHERE sent_at IS NULL AND failed_at IS NULL AND next_retry_at <= CURRENT_TIMESTAMP
      ORDER BY id LIMIT 1`).get();
  }

  queueNotification(notification, payload) {
    this.db.prepare('INSERT OR IGNORE INTO outbound (to_phone, payload, notification_id, assignment_id) VALUES (?, ?, ?, ?)')
      .run(notification.toPhone, JSON.stringify(payload), notification.id, notification.planAssignmentId ?? null);
  }

  assignmentForMessage(messageId) {
    return this.db.prepare('SELECT assignment_id FROM outbound WHERE message_id = ?').get(messageId)?.assignment_id ?? null;
  }

  notificationForMessage(messageId) {
    return this.db.prepare('SELECT notification_id FROM outbound WHERE message_id = ?').get(messageId)?.notification_id ?? null;
  }

  queueEvent(notificationId, status, messageId, error = null) {
    this.db.prepare(`INSERT OR IGNORE INTO bridge_events (event_key, notification_id, status, message_id, error)
      VALUES (?, ?, ?, ?, ?)`).run(`${notificationId}:${status}:${messageId ?? ''}`, notificationId, status, messageId, error?.slice(0, 500) ?? null);
  }

  nextEvent() {
    return this.db.prepare('SELECT * FROM bridge_events ORDER BY id LIMIT 1').get();
  }

  eventDone(id) {
    this.db.prepare('DELETE FROM bridge_events WHERE id = ?').run(id);
  }

  sent(id, messageId = null) {
    this.db.exec('BEGIN');
    try {
      const row = this.db.prepare('SELECT notification_id FROM outbound WHERE id = ?').get(id);
      this.db.prepare("UPDATE outbound SET sent_at = CURRENT_TIMESTAMP, payload = '{}', to_phone = NULL, message_id = ? WHERE id = ?")
        .run(messageId, id);
      if (row.notification_id) this.queueEvent(row.notification_id, 'sent', messageId);
      this.db.exec('COMMIT');
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }

  recordDelivery(messageId, status, error) {
    const notificationId = this.notificationForMessage(messageId);
    if (notificationId) this.queueEvent(notificationId, status, messageId, error);
  }

  sendFailed(id, error = null) {
    this.db.exec('BEGIN');
    try {
      this.db.prepare(`UPDATE outbound SET attempts = attempts + 1,
        next_retry_at = datetime('now', '+30 seconds'),
        failed_at = CASE WHEN attempts >= 4 THEN CURRENT_TIMESTAMP ELSE NULL END,
        payload = CASE WHEN attempts >= 4 THEN '{}' ELSE payload END
        WHERE id = ?`).run(id);
      const row = this.db.prepare('SELECT failed_at, notification_id FROM outbound WHERE id = ?').get(id);
      if (row.failed_at) {
        this.db.prepare('INSERT INTO audit (inbound_id, event) VALUES (?, ?)').run(String(id), row.notification_id ? 'notification_delivery_failed' : 'reply_delivery_failed');
        if (row.notification_id) this.queueEvent(row.notification_id, 'failed', null, error);
      }
      this.db.exec('COMMIT');
      return Boolean(row.failed_at);
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }

  close() {
    this.db.close();
  }
}
