CREATE UNIQUE INDEX IF NOT EXISTS uq_user_plans_payment
  ON user_plans(payment_id)
  WHERE payment_id IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_user_plans_payment'
      AND conrelid = 'user_plans'::regclass
  ) THEN
    ALTER TABLE user_plans
      ADD CONSTRAINT fk_user_plans_payment
      FOREIGN KEY (payment_id) REFERENCES payments(id)
      NOT VALID;
  END IF;
END
$$;
