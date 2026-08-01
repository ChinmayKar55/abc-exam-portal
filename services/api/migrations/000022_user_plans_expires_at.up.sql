-- Add expiry timestamp to user_plans for package duration support.
ALTER TABLE user_plans
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
