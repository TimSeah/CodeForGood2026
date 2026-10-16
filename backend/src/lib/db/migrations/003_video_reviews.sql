-- Private session recordings kept on the local backend computer and analysed with OpenAI.
CREATE TABLE video_reviews (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  storage_path      TEXT NOT NULL UNIQUE,
  original_filename TEXT NOT NULL,
  content_type      TEXT NOT NULL,
  size_bytes        INTEGER NOT NULL,
  status            TEXT NOT NULL DEFAULT 'uploading'
                    CHECK (status IN ('uploading', 'uploaded', 'processing', 'completed', 'failed')),
  summary           TEXT,
  error_message     TEXT,
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE video_review_clips (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  review_id     INTEGER NOT NULL REFERENCES video_reviews(id) ON DELETE CASCADE,
  start_seconds REAL NOT NULL,
  end_seconds   REAL NOT NULL,
  event_type    TEXT NOT NULL CHECK (event_type IN ('possible_escalation', 'recovery', 'notable_progress')),
  caption       TEXT NOT NULL,
  confidence    REAL NOT NULL,
  storage_path  TEXT NOT NULL UNIQUE,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_video_reviews_created ON video_reviews(created_at DESC);
CREATE INDEX idx_video_review_clips_review ON video_review_clips(review_id, start_seconds);
