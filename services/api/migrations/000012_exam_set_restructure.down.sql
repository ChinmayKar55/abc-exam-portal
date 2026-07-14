-- Down migration: revert exam set restructure. Note: plan bundle data is lost.

DROP TABLE IF EXISTS plan_exams;
DROP TABLE IF EXISTS plan_materials;

-- Recreate question_categories
CREATE TABLE IF NOT EXISTS question_categories (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  subject    TEXT NOT NULL DEFAULT '',
  exam_type  TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Recreate category_id columns
ALTER TABLE questions       ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES question_categories(id);
ALTER TABLE exams           ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES question_categories(id);
ALTER TABLE study_materials ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES question_categories(id);
ALTER TABLE pdf_uploads     ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES question_categories(id);

-- Migrate data back (where exam_set_id exists)
UPDATE questions       SET category_id = exam_set_id WHERE category_id IS NULL AND exam_set_id IS NOT NULL;
UPDATE exams           SET category_id = exam_set_id WHERE category_id IS NULL AND exam_set_id IS NOT NULL;
UPDATE study_materials SET category_id = exam_set_id WHERE category_id IS NULL AND exam_set_id IS NOT NULL;
UPDATE pdf_uploads     SET category_id = exam_set_id WHERE category_id IS NULL AND exam_set_id IS NOT NULL;

-- Drop exam_set_id columns and constraints
ALTER TABLE questions       DROP CONSTRAINT IF EXISTS questions_exam_set_id_fkey;
ALTER TABLE exams           DROP CONSTRAINT IF EXISTS exams_exam_set_id_fkey;
ALTER TABLE study_materials DROP CONSTRAINT IF EXISTS study_materials_exam_set_id_fkey;
ALTER TABLE pdf_uploads     DROP CONSTRAINT IF EXISTS pdf_uploads_exam_set_id_fkey;

ALTER TABLE questions       DROP COLUMN IF EXISTS exam_set_id;
ALTER TABLE exams           DROP COLUMN IF EXISTS exam_set_id;
ALTER TABLE study_materials DROP COLUMN IF EXISTS exam_set_id;
ALTER TABLE pdf_uploads     DROP COLUMN IF EXISTS exam_set_id;

DROP INDEX IF EXISTS idx_questions_exam_set;
DROP INDEX IF EXISTS idx_exams_exam_set;
DROP INDEX IF EXISTS idx_study_materials_exam_set;

CREATE INDEX IF NOT EXISTS idx_questions_category ON questions(category_id) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_exams_category ON exams(category_id);
CREATE INDEX IF NOT EXISTS idx_study_materials_category ON study_materials(category_id) WHERE active = true;

-- Recreate the legacy exam columns with defaults
ALTER TABLE exams ADD COLUMN IF NOT EXISTS type exam_type NOT NULL DEFAULT 'mock';
ALTER TABLE exams ADD COLUMN IF NOT EXISTS duration_min INTEGER NOT NULL DEFAULT 60;
ALTER TABLE exams ADD COLUMN IF NOT EXISTS pass_threshold_pct INTEGER NOT NULL DEFAULT 40;
ALTER TABLE exams ADD COLUMN IF NOT EXISTS price_paise INTEGER NOT NULL DEFAULT 0;
ALTER TABLE exams ADD COLUMN IF NOT EXISTS negative_marking BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE exams ADD COLUMN IF NOT EXISTS negative_penalty NUMERIC(4,2) NOT NULL DEFAULT 0.25;
ALTER TABLE exams ADD COLUMN IF NOT EXISTS marks_per_question NUMERIC(4,2) NOT NULL DEFAULT 1.0;
ALTER TABLE exams ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ;

-- Backfill legacy columns from current values
UPDATE exams SET type = exam_type::exam_type, duration_min = duration_minutes, pass_threshold_pct = pass_mark_pct::INTEGER;

-- Recreate old published status handling
UPDATE exams SET status = 'published' WHERE status = 'active';

DROP TABLE IF EXISTS exam_sets;
