CREATE TYPE exam_event_type AS ENUM (
  'session_start',
  'question_viewed',
  'answer_saved',
  'tab_switch',
  'reconnect',
  'manual_submit',
  'auto_submit'
);

CREATE TABLE exam_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id  UUID NOT NULL REFERENCES exam_attempts(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id),
  event_type  exam_event_type NOT NULL,
  payload     JSONB NOT NULL DEFAULT '{}',
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_exam_events_attempt ON exam_events(attempt_id, occurred_at);
CREATE INDEX idx_exam_events_user ON exam_events(user_id);
