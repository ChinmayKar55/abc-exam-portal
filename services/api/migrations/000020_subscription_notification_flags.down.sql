ALTER TABLE user_subscriptions
  DROP COLUMN IF EXISTS expiry_warning_sent,
  DROP COLUMN IF EXISTS expired_notification_sent;
