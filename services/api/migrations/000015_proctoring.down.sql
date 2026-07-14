ALTER TABLE exam_attempts
  DROP COLUMN IF EXISTS violation_count,
  DROP COLUMN IF EXISTS is_flagged,
  DROP COLUMN IF EXISTS webcam_enabled;

DROP INDEX IF EXISTS idx_exam_attempts_flagged;
-- Note: PostgreSQL does not support removing enum values; type values remain.
