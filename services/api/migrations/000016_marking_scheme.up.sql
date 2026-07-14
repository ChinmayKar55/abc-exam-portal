-- Add marking scheme columns back to exams table
ALTER TABLE exams
  ADD COLUMN IF NOT EXISTS marks_per_question NUMERIC(5,2) NOT NULL DEFAULT 1.0,
  ADD COLUMN IF NOT EXISTS negative_marking   BOOLEAN      NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS negative_penalty   NUMERIC(5,2) NOT NULL DEFAULT 0.25;

-- Add raw_score to exam_attempts (marks earned, before percentage)
ALTER TABLE exam_attempts
  ADD COLUMN IF NOT EXISTS raw_score       NUMERIC(8,2),
  ADD COLUMN IF NOT EXISTS total_marks     NUMERIC(8,2),
  ADD COLUMN IF NOT EXISTS wrong_answers   INTEGER;

CREATE INDEX IF NOT EXISTS idx_exams_negative_marking ON exams(negative_marking) WHERE negative_marking = true;
