ALTER TABLE exams DROP COLUMN IF EXISTS exam_type;
ALTER TABLE exams DROP COLUMN IF EXISTS duration_minutes;
ALTER TABLE exams DROP COLUMN IF EXISTS pass_mark_pct;
ALTER TABLE exams DROP COLUMN IF EXISTS shuffle;
ALTER TABLE exam_attempts DROP COLUMN IF EXISTS passed;
ALTER TABLE exam_attempts DROP COLUMN IF EXISTS total_questions;
ALTER TABLE exam_attempts DROP COLUMN IF EXISTS correct_answers;
ALTER TABLE exam_attempts DROP COLUMN IF EXISTS question_ids;
