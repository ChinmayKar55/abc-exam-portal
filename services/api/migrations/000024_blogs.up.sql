CREATE TABLE IF NOT EXISTS blogs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT NOT NULL,
  subtitle    TEXT NOT NULL DEFAULT '',
  slug        TEXT NOT NULL UNIQUE,
  content     TEXT NOT NULL DEFAULT '',
  published   BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_blogs_slug ON blogs(slug);
CREATE INDEX IF NOT EXISTS idx_blogs_published ON blogs(published);
