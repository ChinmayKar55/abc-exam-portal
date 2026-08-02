-- Subscription tier support: Pro / Max plans plus per-exam access tier

-- 1. Tier enum used by subscription tables and exam access control
CREATE TYPE subscription_tier AS ENUM ('pro', 'max');

-- Allow payments to record subscription purchases
ALTER TYPE payment_type ADD VALUE IF NOT EXISTS 'subscription_purchase';

-- 2. System-level subscription tier definitions
CREATE TABLE IF NOT EXISTS subscription_plans (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tier          subscription_tier NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  description   TEXT NOT NULL DEFAULT '',
  price_paise   INTEGER NOT NULL,
  duration_days INTEGER NOT NULL,
  active        BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO subscription_plans (tier, name, description, price_paise, duration_days) VALUES
  ('pro', 'Pro Plan', 'Access all Pro exams for 7 days', 19900, 7),
  ('max', 'Max Plan', 'Access all Pro + Max exams for 3 months', 99900, 90)
ON CONFLICT (tier) DO NOTHING;

-- 3. Active subscriptions per user
CREATE TABLE IF NOT EXISTS user_subscriptions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tier          subscription_tier NOT NULL,
  payment_id    UUID REFERENCES payments(id),
  activated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at    TIMESTAMPTZ NOT NULL,
  active        BOOLEAN NOT NULL DEFAULT true,
  upgraded_from UUID REFERENCES user_subscriptions(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_active ON user_subscriptions(user_id) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_expiry_active ON user_subscriptions(expires_at) WHERE active = true;

-- 4. Per-exam access tier: free (default), pro, max
ALTER TABLE exams
  ADD COLUMN IF NOT EXISTS access_tier TEXT NOT NULL DEFAULT 'free'
  CONSTRAINT exams_access_tier_check CHECK (access_tier IN ('free', 'pro', 'max'));

CREATE INDEX IF NOT EXISTS idx_exams_access_tier ON exams(access_tier);
