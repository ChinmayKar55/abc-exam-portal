-- Multi-bank exam question sources: replace single exam_set_id with per-bank breakup.

-- 1. Create exam_question_sources table
CREATE TABLE IF NOT EXISTS exam_question_sources (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id        UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  bank_id        UUID NOT NULL REFERENCES exam_sets(id),
  question_count INTEGER NOT NULL CHECK (question_count > 0),
  UNIQUE (exam_id, bank_id)
);

CREATE INDEX IF NOT EXISTS idx_eqs_exam ON exam_question_sources(exam_id);
CREATE INDEX IF NOT EXISTS idx_eqs_bank ON exam_question_sources(bank_id);

-- 2. Migrate existing single-bank exams into exam_question_sources
INSERT INTO exam_question_sources (exam_id, bank_id, question_count)
SELECT id, exam_set_id, total_questions
FROM exams
WHERE exam_set_id IS NOT NULL
ON CONFLICT (exam_id, bank_id) DO NOTHING;

-- 3. Drop exam_set_id from exams (data now lives in exam_question_sources)
ALTER TABLE exams DROP COLUMN IF EXISTS exam_set_id;
