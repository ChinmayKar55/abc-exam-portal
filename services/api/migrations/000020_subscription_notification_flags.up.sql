ALTER TABLE user_subscriptions
  ADD COLUMN IF NOT EXISTS expiry_warning_sent BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS expired_notification_sent BOOLEAN NOT NULL DEFAULT false;
