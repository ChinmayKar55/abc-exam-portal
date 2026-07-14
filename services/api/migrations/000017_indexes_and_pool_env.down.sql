-- Revert performance indexes added in 000017.
DROP INDEX IF EXISTS idx_exam_attempts_user_status;
DROP INDEX IF EXISTS idx_exam_attempts_status_full;
DROP INDEX IF EXISTS idx_exam_attempts_exam_started_at;
DROP INDEX IF EXISTS idx_exam_attempts_started_at;
DROP INDEX IF EXISTS idx_users_role_created_at;
DROP INDEX IF EXISTS idx_users_created_at;
DROP INDEX IF EXISTS idx_pdf_uploads_uploaded_at;
DROP INDEX IF EXISTS idx_refresh_tokens_token_hash;
DROP INDEX IF EXISTS idx_payments_user_status;
DROP INDEX IF EXISTS idx_payments_status_created_at;
DROP INDEX IF EXISTS idx_study_materials_active_title;
DROP INDEX IF EXISTS idx_questions_exam_set_active_created_at;
