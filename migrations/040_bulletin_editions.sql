-- ── 040: Bulletin editions — numbered, frozen publications ─────────────────
-- Government bulletins are numbered frozen editions, not a live page. A draft
-- freezes a snapshot of the computed statistics at creation (the data
-- cutoff); editors add per-sector commentary; an admin publishes. Published
-- editions never change; corrections come as a new edition.

CREATE TABLE IF NOT EXISTS bulletin_editions (
  id            SERIAL PRIMARY KEY,
  edition_no    INT NOT NULL UNIQUE,
  title         TEXT NOT NULL DEFAULT 'NEDB Monthly Energy Bulletin',
  period_label  TEXT NOT NULL,                       -- e.g. "August 2026"
  status        TEXT NOT NULL DEFAULT 'draft',       -- draft | published
  commentary    JSONB NOT NULL DEFAULT '{}'::jsonb,  -- { sector_key: text }
  snapshot      JSONB NOT NULL DEFAULT '{}'::jsonb,  -- frozen BulletinData
  data_cutoff   TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by    TEXT,
  published_by  TEXT,
  published_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE bulletin_editions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_bulletin_editions" ON bulletin_editions USING (true) WITH CHECK (true);
