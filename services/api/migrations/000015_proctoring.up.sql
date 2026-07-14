-- Extend exam_event_type with proctoring violation types
ALTER TYPE exam_event_type ADD VALUE IF NOT EXISTS 'tab_switch_return';
ALTER TYPE exam_event_type ADD VALUE IF NOT EXISTS 'window_blur';
ALTER TYPE exam_event_type ADD VALUE IF NOT EXISTS 'window_focus';
ALTER TYPE exam_event_type ADD VALUE IF NOT EXISTS 'fullscreen_exit';
ALTER TYPE exam_event_type ADD VALUE IF NOT EXISTS 'fullscreen_enter';
ALTER TYPE exam_event_type ADD VALUE IF NOT EXISTS 'devtools_open';
ALTER TYPE exam_event_type ADD VALUE IF NOT EXISTS 'copy_attempt';
ALTER TYPE exam_event_type ADD VALUE IF NOT EXISTS 'paste_attempt';
ALTER TYPE exam_event_type ADD VALUE IF NOT EXISTS 'keyboard_shortcut';
ALTER TYPE exam_event_type ADD VALUE IF NOT EXISTS 'no_face_detected';
ALTER TYPE exam_event_type ADD VALUE IF NOT EXISTS 'multiple_faces';
ALTER TYPE exam_event_type ADD VALUE IF NOT EXISTS 'gaze_away';
ALTER TYPE exam_event_type ADD VALUE IF NOT EXISTS 'webcam_denied';
ALTER TYPE exam_event_type ADD VALUE IF NOT EXISTS 'proctoring_start';

-- Add proctoring fields to exam_attempts
ALTER TABLE exam_attempts
  ADD COLUMN IF NOT EXISTS violation_count   INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_flagged        BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS webcam_enabled    BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_exam_attempts_flagged ON exam_attempts(is_flagged) WHERE is_flagged = TRUE;
