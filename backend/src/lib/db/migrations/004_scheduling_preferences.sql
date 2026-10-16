-- Admin-confirmed scheduling preference memory. See docs/plans/scheduling-preferences.md.

-- One row each time an admin moves a PROPOSED therapist off a draft assignment (change or row reject).
-- Only rows with a pattern reason (child_incompatible / therapist_time_unavailable) count as evidence.
CREATE TABLE assignment_change_events (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  plan_id               INTEGER NOT NULL REFERENCES plans(id),
  plan_assignment_id    INTEGER NOT NULL REFERENCES plan_assignments(id),
  session_id            INTEGER NOT NULL REFERENCES sessions(id),
  date                  TEXT NOT NULL,
  slot                  TEXT NOT NULL CHECK (slot IN ('AM', 'PM')),
  start_time            TEXT NOT NULL,                        -- actual session times (HH:MM, SGT)
  end_time              TEXT NOT NULL,
  student_id            INTEGER NOT NULL REFERENCES students(id),
  removed_therapist_id  INTEGER NOT NULL REFERENCES therapists(id),
  new_therapist_id      INTEGER REFERENCES therapists(id),   -- NULL = admin cancelled / nobody left
  action                TEXT NOT NULL CHECK (action IN ('edited', 'rejected')),
  reason_code           TEXT CHECK (reason_code IN ('child_incompatible', 'therapist_time_unavailable', 'better_fit', 'one_off', 'other')),
  reason_note           TEXT,
  actor                 TEXT NOT NULL,
  created_at            TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_change_events_reason ON assignment_change_events(reason_code, removed_therapist_id);

-- Suggestions AND active rules live here, distinguished by status. Only status = 'active' affects scheduling.
CREATE TABLE scheduling_preferences (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  type               TEXT NOT NULL CHECK (type IN ('pairing', 'time_unavailable')),
  therapist_id       INTEGER NOT NULL REFERENCES therapists(id),
  student_id         INTEGER REFERENCES students(id),       -- pairing only
  strength           TEXT NOT NULL CHECK (strength IN ('soft', 'hard')),
  status             TEXT NOT NULL CHECK (status IN ('suggested', 'active', 'paused', 'rejected', 'removed')),
  source             TEXT NOT NULL CHECK (source IN ('pattern', 'admin', 'agent_prompt')),
  -- time_unavailable only: weekdays (0 = Sun … 6 = Sat), boundary and what it applies to.
  days               TEXT,                                  -- JSON array of ints
  boundary_time      TEXT,                                  -- HH:MM
  applies_to         TEXT CHECK (applies_to IN ('start', 'end')),
  effective_from     TEXT,                                  -- YYYY-MM-DD, NULL = no start limit
  effective_to       TEXT,                                  -- YYYY-MM-DD, NULL = ongoing
  reason             TEXT,
  question           TEXT,                                  -- what the system asked the admin (suggestions)
  signature          TEXT NOT NULL,                         -- dedup key, e.g. "pairing:3:12" / "time:3"
  evidence_event_ids TEXT NOT NULL DEFAULT '[]',            -- JSON array of assignment_change_events ids
  removed_after_event_id INTEGER,                           -- on removal: newest change event id; only later events can re-suggest
  agent_prompt       TEXT,                                  -- source = agent_prompt: the instruction it came from
  confirmed_by       TEXT,
  confirmed_at       TEXT,
  created_by         TEXT NOT NULL,
  created_at         TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at         TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (type != 'pairing' OR student_id IS NOT NULL)
);
CREATE INDEX idx_preferences_status ON scheduling_preferences(status);
CREATE INDEX idx_preferences_signature ON scheduling_preferences(signature);
