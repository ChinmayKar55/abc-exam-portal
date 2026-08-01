-- Revert subscription tier support

DROP INDEX IF EXISTS idx_exams_access_tier;
ALTER TABLE exams DROP COLUMN IF EXISTS access_tier;

DROP INDEX IF EXISTS idx_user_subscriptions_expiry_active;
DROP INDEX IF EXISTS idx_user_subscriptions_user_active;
DROP TABLE IF EXISTS user_subscriptions;

DROP TABLE IF EXISTS subscription_plans;
DROP TYPE IF EXISTS subscription_tier;
