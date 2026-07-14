-- Exam set restructure: replace question_categories with exam_sets, link questions/exams/materials to exam sets, and add plan bundles.

-- 1. Create exam_sets from question_categories
CREATE TABLE IF NOT EXISTS exam_sets (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO exam_sets (id, name, description, created_at)
SELECT id, name, COALESCE(NULLIF(subject, ''), name), created_at FROM question_categories
ON CONFLICT (id) DO NOTHING;

-- 2. Add exam_set_id columns to tables currently using category_id
ALTER TABLE questions       ADD COLUMN IF NOT EXISTS exam_set_id UUID REFERENCES exam_sets(id);
ALTER TABLE exams           ADD COLUMN IF NOT EXISTS exam_set_id UUID REFERENCES exam_sets(id);
ALTER TABLE study_materials ADD COLUMN IF NOT EXISTS exam_set_id UUID REFERENCES exam_sets(id);
ALTER TABLE pdf_uploads     ADD COLUMN IF NOT EXISTS exam_set_id UUID REFERENCES exam_sets(id);

-- 3. Migrate category_id -> exam_set_id
UPDATE questions       SET exam_set_id = category_id WHERE exam_set_id IS NULL AND category_id IS NOT NULL;
UPDATE exams           SET exam_set_id = category_id WHERE exam_set_id IS NULL AND category_id IS NOT NULL;
UPDATE study_materials SET exam_set_id = category_id WHERE exam_set_id IS NULL AND category_id IS NOT NULL;
UPDATE pdf_uploads     SET exam_set_id = category_id WHERE exam_set_id IS NULL AND category_id IS NOT NULL;

-- 4. Make exam_set_id required where it was previously required via category_id
ALTER TABLE questions       ALTER COLUMN exam_set_id SET NOT NULL;
ALTER TABLE exams           ALTER COLUMN exam_set_id SET NOT NULL;
ALTER TABLE study_materials ALTER COLUMN exam_set_id SET NOT NULL;
ALTER TABLE pdf_uploads     ALTER COLUMN exam_set_id DROP NOT NULL;

-- 5. Drop old category_id columns and indexes
ALTER TABLE questions       DROP CONSTRAINT IF EXISTS questions_category_id_fkey;
ALTER TABLE exams           DROP CONSTRAINT IF EXISTS exams_category_id_fkey;
ALTER TABLE study_materials DROP CONSTRAINT IF EXISTS study_materials_category_id_fkey;
ALTER TABLE pdf_uploads     DROP CONSTRAINT IF EXISTS pdf_uploads_category_id_fkey;

ALTER TABLE questions       DROP COLUMN IF EXISTS category_id;
ALTER TABLE exams           DROP COLUMN IF EXISTS category_id;
ALTER TABLE study_materials DROP COLUMN IF EXISTS category_id;
ALTER TABLE pdf_uploads     DROP COLUMN IF EXISTS category_id;

DROP INDEX IF EXISTS idx_questions_category;
DROP INDEX IF EXISTS idx_exams_category;
DROP INDEX IF EXISTS idx_study_materials_category;
DROP INDEX IF EXISTS idx_pdf_uploads_category;

CREATE INDEX IF NOT EXISTS idx_questions_exam_set ON questions(exam_set_id) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_exams_exam_set ON exams(exam_set_id);
CREATE INDEX IF NOT EXISTS idx_study_materials_exam_set ON study_materials(exam_set_id) WHERE active = true;

-- 6. Drop the duplicate exam columns now that aliases are populated
ALTER TABLE exams DROP COLUMN IF EXISTS type;
ALTER TABLE exams DROP COLUMN IF EXISTS duration_min;
ALTER TABLE exams DROP COLUMN IF EXISTS pass_threshold_pct;
ALTER TABLE exams DROP COLUMN IF EXISTS price_paise;
ALTER TABLE exams DROP COLUMN IF EXISTS negative_marking;
ALTER TABLE exams DROP COLUMN IF EXISTS negative_penalty;
ALTER TABLE exams DROP COLUMN IF EXISTS marks_per_question;
ALTER TABLE exams DROP COLUMN IF EXISTS scheduled_at;

-- 7. Ensure exam_status enum matches code values
ALTER TYPE exam_status ADD VALUE IF NOT EXISTS 'active';
ALTER TYPE exam_status ADD VALUE IF NOT EXISTS 'archived';

-- 8. Update any leftover 'published' rows to 'active' and make status default to draft
UPDATE exams SET status = 'active' WHERE status = 'published';

-- 9. Create plan bundle tables
CREATE TABLE IF NOT EXISTS plan_exams (
  id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  exam_id UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  UNIQUE(plan_id, exam_id)
);

CREATE TABLE IF NOT EXISTS plan_materials (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id     UUID NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  material_id UUID NOT NULL REFERENCES study_materials(id) ON DELETE CASCADE,
  UNIQUE(plan_id, material_id)
);

CREATE INDEX IF NOT EXISTS idx_plan_exams_plan ON plan_exams(plan_id);
CREATE INDEX IF NOT EXISTS idx_plan_materials_plan ON plan_materials(plan_id);

-- 10. Drop question_categories after data migration
DROP TABLE IF EXISTS question_categories;
