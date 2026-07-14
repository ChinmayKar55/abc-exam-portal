INSERT INTO plans (id, name, description, features, price_paise, active) VALUES
(
  gen_random_uuid(),
  'Plan A — Mock Only',
  'Access to all mock exam papers with unlimited attempts. Perfect for practice.',
  '{"mock_exams": true, "paid_exams": false, "study_material": false, "unlimited_attempts": true}',
  49900,
  true
),
(
  gen_random_uuid(),
  'Plan B — Mock + Material',
  'Full preparation bundle: mock exams with unlimited attempts plus study material PDFs.',
  '{"mock_exams": true, "paid_exams": false, "study_material": true, "unlimited_attempts": true}',
  99900,
  true
);
