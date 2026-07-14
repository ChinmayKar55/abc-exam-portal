CREATE TYPE attempt_status AS ENUM ('in_progress', 'submitted', 'expired', 'abandoned');
CREATE TYPE pdf_gen_status AS ENUM ('pending', 'processing', 'ready', 'failed');

CREATE TABLE exam_attempts (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES users(id),
  exam_id           UUID NOT NULL REFERENCES exams(id),
  started_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  submitted_at      TIMESTAMPTZ,
  shuffle_seed      BIGINT NOT NULL DEFAULT 0,
  shuffled_paper    JSONB NOT NULL DEFAULT '[]',
  answers           JSONB NOT NULL DEFAULT '{}',
  score             NUMERIC(8,2),
  total_marks       NUMERIC(8,2),
  correct_count     INTEGER,
  incorrect_count   INTEGER,
  unattempted_count INTEGER,
  accuracy_pct      NUMERIC(5,2),
  time_taken_sec    INTEGER,
  status            attempt_status NOT NULL DEFAULT 'in_progress',
  pdf_status        pdf_gen_status NOT NULL DEFAULT 'pending',
  pdf_url           TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_exam_attempts_user ON exam_attempts(user_id);
CREATE INDEX idx_exam_attempts_exam ON exam_attempts(exam_id);
CREATE INDEX idx_exam_attempts_status ON exam_attempts(status) WHERE status = 'in_progress';
CREATE INDEX idx_exam_attempts_user_exam ON exam_attempts(user_id, exam_id);
