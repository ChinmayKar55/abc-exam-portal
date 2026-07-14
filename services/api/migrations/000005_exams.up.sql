CREATE TYPE exam_type AS ENUM ('mock', 'paid', 'practice');
CREATE TYPE exam_status AS ENUM ('draft', 'active', 'archived');

CREATE TABLE exams (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title              TEXT NOT NULL,
  description        TEXT NOT NULL DEFAULT '',
  type               exam_type NOT NULL,
  category_id        UUID NOT NULL REFERENCES question_categories(id),
  duration_min       INTEGER NOT NULL,
  total_questions    INTEGER NOT NULL,
  negative_marking   BOOLEAN NOT NULL DEFAULT false,
  negative_penalty   NUMERIC(4,2) NOT NULL DEFAULT 0.25,
  pass_threshold_pct INTEGER NOT NULL DEFAULT 40,
  marks_per_question NUMERIC(4,2) NOT NULL DEFAULT 1.0,
  price_paise        INTEGER NOT NULL DEFAULT 0,
  status             exam_status NOT NULL DEFAULT 'draft',
  scheduled_at       TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_exams_category ON exams(category_id);
CREATE INDEX idx_exams_status ON exams(status);
CREATE INDEX idx_exams_type ON exams(type);
