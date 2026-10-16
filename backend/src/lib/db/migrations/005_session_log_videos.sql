ALTER TABLE video_reviews
  ADD COLUMN session_log_id INTEGER REFERENCES session_logs(id) ON DELETE CASCADE;

CREATE UNIQUE INDEX idx_video_reviews_session_log
  ON video_reviews(session_log_id)
  WHERE session_log_id IS NOT NULL;

ALTER TABLE video_review_clips
  ADD COLUMN title TEXT NOT NULL DEFAULT 'Important moment';

UPDATE video_review_clips
SET title = substr(caption, 1, 60)
WHERE caption <> '';
