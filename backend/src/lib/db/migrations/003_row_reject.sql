-- Per-row reject / undo on draft plans (Approval page).
-- rejected_therapist_ids: therapists the admin rejected for this row in this plan (JSON array of ids).
-- history: stack of previous states of the row so "Undo" can restore them (JSON array, newest last).
ALTER TABLE plan_assignments ADD COLUMN rejected_therapist_ids TEXT NOT NULL DEFAULT '[]';
ALTER TABLE plan_assignments ADD COLUMN history TEXT NOT NULL DEFAULT '[]';
