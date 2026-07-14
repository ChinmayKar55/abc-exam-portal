ALTER TABLE exams
  DROP COLUMN IF EXISTS marks_per_question,
  DROP COLUMN IF EXISTS negative_marking,
  DROP COLUMN IF EXISTS negative_penalty;

ALTER TABLE exam_attempts
  DROP COLUMN IF EXISTS raw_score,
  DROP COLUMN IF EXISTS total_marks,
  DROP COLUMN IF EXISTS wrong_answers;

DROP INDEX IF EXISTS idx_exams_negative_marking;
