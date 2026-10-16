-- Rescheduling workflow: child profiles, blacklist, weekly patterns, bot intake, plans, session logs.
-- See docs/plans/rescheduling.md.

ALTER TABLE students ADD COLUMN home_area TEXT;
ALTER TABLE students ADD COLUMN guardian_name TEXT;
ALTER TABLE students ADD COLUMN guardian_phone TEXT;

-- Therapists the parents are not comfortable with. Engine uses them only as a last resort.
CREATE TABLE student_blacklist (
  student_id   INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  therapist_id INTEGER NOT NULL REFERENCES therapists(id) ON DELETE CASCADE,
  reason       TEXT,
  PRIMARY KEY (student_id, therapist_id)
);

-- Recurring monthly allocation (Case-Allocation.xlsx): MWF / TT pattern per therapist and slot.
CREATE TABLE weekly_patterns (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  month        TEXT NOT NULL,                                  -- YYYY-MM
  therapist_id INTEGER NOT NULL REFERENCES therapists(id) ON DELETE CASCADE,
  days         TEXT NOT NULL CHECK (days IN ('MWF', 'TT')),
  slot         TEXT NOT NULL CHECK (slot IN ('AM', 'PM')),
  start_time   TEXT,
  end_time     TEXT,
  student_id   INTEGER REFERENCES students(id) ON DELETE CASCADE, -- NULL + is_off = 0 → free
  location     TEXT NOT NULL DEFAULT 'clinic' CHECK (location IN ('clinic', 'home', 'school')),
  is_off       INTEGER NOT NULL DEFAULT 0                       -- rostered off ("x" in the sheet)
);
CREATE INDEX idx_weekly_patterns_month ON weekly_patterns(month);

-- Reports copied from the WhatsApp bot's own SQLite DB (bot/absences.sqlite → absences table).
CREATE TABLE bot_reports (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  source_id            TEXT UNIQUE,                             -- "bot:<absences.id>" (NULL for simulated)
  role                 TEXT NOT NULL CHECK (role IN ('therapist', 'patient')),
  name                 TEXT NOT NULL,                           -- as typed by the reporter
  phone                TEXT,
  start_date           TEXT NOT NULL,
  end_date             TEXT NOT NULL,
  day_part             TEXT NOT NULL CHECK (day_part IN ('whole day', 'morning', 'afternoon')),
  mc_attached          INTEGER NOT NULL DEFAULT 0,
  reported_at          TEXT NOT NULL,
  status               TEXT NOT NULL DEFAULT 'unmatched' CHECK (status IN ('ingested', 'unmatched', 'ignored')),
  matched_therapist_id INTEGER REFERENCES therapists(id),
  matched_student_id   INTEGER REFERENCES students(id),
  ingested_at          TEXT
);

ALTER TABLE absences ADD COLUMN bot_report_id INTEGER REFERENCES bot_reports(id);

-- A tentative set of changes for one date. Approving applies its assignments to `sessions`.
CREATE TABLE plans (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  date           TEXT NOT NULL,
  kind           TEXT NOT NULL DEFAULT 'primary' CHECK (kind IN ('primary', 'swap_alternative', 'replan')),
  status         TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'rejected', 'superseded')),
  parent_plan_id INTEGER REFERENCES plans(id),                 -- swap alternative → its primary plan
  notify_mode    TEXT CHECK (notify_mode IN ('whatsapp', 'manual')),
  created_by     TEXT NOT NULL DEFAULT 'engine',
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  decided_by     TEXT,
  decided_at     TEXT
);
CREATE INDEX idx_plans_date ON plans(date);

CREATE TABLE plan_assignments (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  plan_id             INTEGER NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  session_id          INTEGER NOT NULL REFERENCES sessions(id),
  from_therapist_id   INTEGER REFERENCES therapists(id),
  to_therapist_id     INTEGER REFERENCES therapists(id),       -- NULL = cancel the session
  step                TEXT NOT NULL CHECK (step IN ('team', 'tier', 'history', 'any', 'blacklisted', 'swap', 'cancel', 'manual')),
  distance_km         REAL,
  rationale           TEXT NOT NULL DEFAULT '[]',              -- JSON array of strings
  chain_id            TEXT,                                    -- groups the moves of one swap chain
  edited_by_admin     INTEGER NOT NULL DEFAULT 0,
  -- Parent acceptance after approval. 'not_required' for cancellations.
  parent_status       TEXT NOT NULL DEFAULT 'pending' CHECK (parent_status IN ('pending', 'accepted', 'declined', 'expired', 'not_required')),
  parent_responded_at TEXT,
  UNIQUE (plan_id, session_id)
);

-- Parent declined → never propose this therapist for this session again.
CREATE TABLE assignment_exclusions (
  session_id   INTEGER NOT NULL REFERENCES sessions(id),
  therapist_id INTEGER NOT NULL REFERENCES therapists(id),
  PRIMARY KEY (session_id, therapist_id)
);

-- Outbound WhatsApp messages (outbox). Recreated: the 001 version pointed at the dropped reallocations table.
DROP TABLE notifications;
CREATE TABLE notifications (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  recipient_type     TEXT NOT NULL CHECK (recipient_type IN ('therapist', 'guardian', 'supervisor')),
  recipient_id       INTEGER,
  to_phone           TEXT,
  channel            TEXT NOT NULL DEFAULT 'whatsapp',
  purpose            TEXT NOT NULL,                             -- parent_confirm, therapist_cover, parent_call_centre, ...
  body               TEXT NOT NULL,
  attachment         TEXT,                                      -- e.g. /api/session-logs/12/pdf
  status             TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'placeholder')),
  plan_assignment_id INTEGER REFERENCES plan_assignments(id),
  created_at         TEXT NOT NULL DEFAULT (datetime('now'))
);

-- What actually happened in a session (therapist portal). Feeds the engine's "history" step.
CREATE TABLE session_logs (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id   INTEGER REFERENCES sessions(id) ON DELETE SET NULL,
  date         TEXT NOT NULL,
  slot         TEXT NOT NULL CHECK (slot IN ('AM', 'PM')),
  student_id   INTEGER NOT NULL REFERENCES students(id),
  therapist_id INTEGER NOT NULL REFERENCES therapists(id),
  attendance   TEXT NOT NULL CHECK (attendance IN ('present', 'late', 'absent', 'cancelled')),
  summary      TEXT,                                           -- shareable with a substitute therapist
  notes        TEXT,                                           -- private clinical notes
  goals        TEXT,                                           -- programmes / goals worked on
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_session_logs_student ON session_logs(student_id, date);
CREATE INDEX idx_session_logs_therapist ON session_logs(therapist_id, date);

DROP TABLE reallocations; -- replaced by plans + plan_assignments
