-- Add missing columns to exams table (engine-compatible aliases)
ALTER TABLE exams
  ADD COLUMN IF NOT EXISTS exam_type      TEXT NOT NULL DEFAULT 'mock',
  ADD COLUMN IF NOT EXISTS duration_minutes INTEGER NOT NULL DEFAULT 60,
  ADD COLUMN IF NOT EXISTS pass_mark_pct  NUMERIC(5,2) NOT NULL DEFAULT 40,
  ADD COLUMN IF NOT EXISTS shuffle        BOOLEAN NOT NULL DEFAULT true;

-- Backfill from original columns
UPDATE exams SET
  exam_type = type::TEXT,
  duration_minutes = duration_min,
  pass_mark_pct = pass_threshold_pct;

-- Add 'published' and 'timed_out'/'graded' values if not present
ALTER TYPE exam_status ADD VALUE IF NOT EXISTS 'published';
ALTER TYPE attempt_status ADD VALUE IF NOT EXISTS 'timed_out';
ALTER TYPE attempt_status ADD VALUE IF NOT EXISTS 'graded';

-- Add missing columns to exam_attempts
ALTER TABLE exam_attempts
  ADD COLUMN IF NOT EXISTS passed          BOOLEAN,
  ADD COLUMN IF NOT EXISTS total_questions INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS correct_answers INTEGER,
  ADD COLUMN IF NOT EXISTS question_ids    JSONB NOT NULL DEFAULT '[]';

-- Rename score column alias (keep score, add correct_answers from correct_count)
UPDATE exam_attempts SET correct_answers = correct_count WHERE correct_answers IS NULL;
