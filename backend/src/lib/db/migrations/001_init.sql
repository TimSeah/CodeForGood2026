-- Initial schema. Never edit a migration teammates may already have run; add 002_xxx.sql instead.

CREATE TABLE therapists (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  name         TEXT    NOT NULL UNIQUE,
  rank         TEXT    NOT NULL CHECK (rank IN ('SBT', 'LBT', 'BT', 'PT')),
  is_part_time INTEGER NOT NULL DEFAULT 0,
  home_area    TEXT,
  phone        TEXT,
  created_at   TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE students (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  name             TEXT NOT NULL UNIQUE,
  plan             TEXT CHECK (plan IN ('Core', 'Advanced', 'Specialised')),
  guardian_contact TEXT,
  created_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

-- A child's team (1-4 therapists). Used for familiarity when picking replacements.
CREATE TABLE team_members (
  student_id    INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  therapist_id  INTEGER NOT NULL REFERENCES therapists(id) ON DELETE CASCADE,
  PRIMARY KEY (student_id, therapist_id)
);

CREATE TABLE sessions (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  date                  TEXT NOT NULL,                       -- YYYY-MM-DD
  slot                  TEXT NOT NULL CHECK (slot IN ('AM', 'PM')),
  start_time            TEXT NOT NULL,                       -- HH:MM 24h
  end_time              TEXT NOT NULL,
  location              TEXT NOT NULL DEFAULT 'clinic' CHECK (location IN ('clinic', 'home', 'school')),
  status                TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'cancelled')),
  student_id            INTEGER NOT NULL REFERENCES students(id),
  therapist_id          INTEGER REFERENCES therapists(id),
  original_therapist_id INTEGER REFERENCES therapists(id),
  cancel_reason         TEXT,
  UNIQUE (date, slot, student_id, therapist_id)
);
CREATE INDEX idx_sessions_date ON sessions(date);
CREATE INDEX idx_sessions_therapist_date ON sessions(therapist_id, date);

CREATE TABLE absences (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  therapist_id INTEGER NOT NULL REFERENCES therapists(id),
  date         TEXT NOT NULL,
  slot         TEXT CHECK (slot IN ('AM', 'PM')),            -- NULL = whole day
  type         TEXT NOT NULL CHECK (type IN ('annual', 'medical', 'urgent', 'off', 'other')), -- 'off' = rostered off (part-timers)
  note         TEXT,
  reported_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_absences_date ON absences(date);

-- Every proposed change (by the engine or a human) and its approval decision.
CREATE TABLE reallocations (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id        INTEGER NOT NULL REFERENCES sessions(id),
  from_therapist_id INTEGER REFERENCES therapists(id),
  to_therapist_id   INTEGER REFERENCES therapists(id),       -- NULL = cancel the session
  score             REAL,
  rationale         TEXT NOT NULL DEFAULT '[]',              -- JSON array of strings
  status            TEXT NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed', 'approved', 'rejected')),
  proposed_by       TEXT NOT NULL DEFAULT 'engine',
  decided_by        TEXT,
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  decided_at        TEXT
);
CREATE INDEX idx_reallocations_session ON reallocations(session_id);

-- Outbound messages to therapists / families (WhatsApp/SMS). Rows are created; actual sending is TODO.
CREATE TABLE notifications (
  id                      INTEGER PRIMARY KEY AUTOINCREMENT,
  recipient_type          TEXT NOT NULL CHECK (recipient_type IN ('therapist', 'guardian', 'supervisor')),
  recipient_id            INTEGER,
  channel                 TEXT NOT NULL DEFAULT 'whatsapp',
  body                    TEXT NOT NULL,
  status                  TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  related_reallocation_id INTEGER REFERENCES reallocations(id),
  created_at              TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Append-only audit trail. Write to it via repositories/audit.ts for every state change.
CREATE TABLE audit_log (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  actor       TEXT NOT NULL,
  action      TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id   INTEGER,
  details     TEXT,                                          -- JSON
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
