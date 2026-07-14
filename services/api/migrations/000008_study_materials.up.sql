CREATE TABLE study_materials (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID REFERENCES question_categories(id),
  title       TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  file_url    TEXT NOT NULL,
  file_size   BIGINT NOT NULL DEFAULT 0,
  uploaded_by UUID NOT NULL REFERENCES users(id),
  active      BOOLEAN NOT NULL DEFAULT true,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_study_materials_category ON study_materials(category_id) WHERE active = true;
