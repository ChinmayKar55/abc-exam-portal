-- Performance indexes for the exam engine and admin dashboards.
-- All CREATE statements are idempotent (IF NOT EXISTS).

-- 1. User-facing result list: filter by user_id and status (graded / timed_out)
CREATE INDEX IF NOT EXISTS idx_exam_attempts_user_status ON exam_attempts(user_id, status);

-- 2. Status filters beyond the existing partial 'in_progress' index
CREATE INDEX IF NOT EXISTS idx_exam_attempts_status_full ON exam_attempts(status);

-- 3. Admin attempts list: filter by exam_id and order by started_at DESC
CREATE INDEX IF NOT EXISTS idx_exam_attempts_exam_started_at ON exam_attempts(exam_id, started_at DESC);

-- 4. Admin attempts list: order by started_at DESC without exam filter
CREATE INDEX IF NOT EXISTS idx_exam_attempts_started_at ON exam_attempts(started_at DESC);

-- 5. Admin users list: filter by role and order by created_at DESC
CREATE INDEX IF NOT EXISTS idx_users_role_created_at ON users(role, created_at DESC);

-- 6. Fallback ordering for users list
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at DESC);

-- 7. Admin uploads list: order by uploaded_at DESC
CREATE INDEX IF NOT EXISTS idx_pdf_uploads_uploaded_at ON pdf_uploads(uploaded_at DESC);

-- 8. Token lookups for refresh, logout, and rotation
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token_hash ON refresh_tokens(token_hash);

-- 9. Payment lookups by user + status (webhook, verify, admin stats)
CREATE INDEX IF NOT EXISTS idx_payments_user_status ON payments(user_id, status);

-- 10. Payment status + time ordering for revenue / reconciliation queries
CREATE INDEX IF NOT EXISTS idx_payments_status_created_at ON payments(status, created_at DESC);

-- 11. Study materials list: filter active and order by title
CREATE INDEX IF NOT EXISTS idx_study_materials_active_title ON study_materials(active, title);

-- 12. Question list: filter by exam_set_id + active and order by created_at DESC
CREATE INDEX IF NOT EXISTS idx_questions_exam_set_active_created_at ON questions(exam_set_id, active, created_at DESC);
