-- Reverse migration: restore exam_set_id from first source row, drop exam_question_sources.

ALTER TABLE exams ADD COLUMN IF NOT EXISTS exam_set_id UUID REFERENCES exam_sets(id);

UPDATE exams e
SET exam_set_id = (
  SELECT bank_id FROM exam_question_sources WHERE exam_id = e.id LIMIT 1
);

DROP TABLE IF EXISTS exam_question_sources;
