-- Add pinned_question_ids to exam_question_sources for manual question selection.
ALTER TABLE exam_question_sources
  ADD COLUMN IF NOT EXISTS pinned_question_ids UUID[] NOT NULL DEFAULT '{}';
