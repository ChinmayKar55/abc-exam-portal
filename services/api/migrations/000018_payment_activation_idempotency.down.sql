ALTER TABLE user_plans
  DROP CONSTRAINT IF EXISTS fk_user_plans_payment;

DROP INDEX IF EXISTS uq_user_plans_payment;
