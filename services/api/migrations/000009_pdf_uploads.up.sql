CREATE TYPE parse_status AS ENUM ('pending', 'processing', 'parsed', 'published', 'failed');

CREATE TABLE pdf_uploads (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uploaded_by         UUID NOT NULL REFERENCES users(id),
  filename            TEXT NOT NULL,
  file_path           TEXT NOT NULL,
  file_size           BIGINT NOT NULL DEFAULT 0,
  category_id         UUID REFERENCES question_categories(id),
  parse_status        parse_status NOT NULL DEFAULT 'pending',
  questions_extracted INTEGER NOT NULL DEFAULT 0,
  questions_published INTEGER NOT NULL DEFAULT 0,
  error_log           TEXT,
  parsed_data         JSONB NOT NULL DEFAULT '[]',
  uploaded_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  parsed_at           TIMESTAMPTZ
);

CREATE INDEX idx_pdf_uploads_uploader ON pdf_uploads(uploaded_by);
CREATE INDEX idx_pdf_uploads_status ON pdf_uploads(parse_status);
