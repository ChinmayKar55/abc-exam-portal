ALTER TABLE plans DROP COLUMN IF EXISTS duration_days;

ALTER TABLE user_plans
  DROP COLUMN IF EXISTS expired_notification_sent,
  DROP COLUMN IF EXISTS expiry_warning_sent;
