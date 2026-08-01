-- Package expiry support

-- Allow admins to set how many days a package lasts after purchase.
-- A value of 0 means the package never expires (default for existing plans).
ALTER TABLE plans
  ADD COLUMN IF NOT EXISTS duration_days INTEGER NOT NULL DEFAULT 0;

-- Track notification state for package expiry, mirroring user_subscriptions.
ALTER TABLE user_plans
  ADD COLUMN IF NOT EXISTS expiry_warning_sent BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS expired_notification_sent BOOLEAN NOT NULL DEFAULT false;
