-- ── 043: Editorial layer — stories, subscriber topics, broadcasts ──────────
-- The bulletin so far has been auto-generated statistics. A statistics office
-- also publishes ANALYSIS: short signed pieces explaining what moved and why.
-- Those are stories. They follow the same maker-checker rule as everything
-- else: an editor drafts, an administrator publishes.
--
-- Subscribers gain topics so a reader can follow the sectors they care about
-- rather than receiving everything, and broadcasts are recorded so an
-- editorial send is auditable and cannot be silently repeated.

CREATE TABLE IF NOT EXISTS bulletin_stories (
  id            SERIAL PRIMARY KEY,
  slug          TEXT NOT NULL UNIQUE,
  title         TEXT NOT NULL,
  standfirst    TEXT,                                -- one-sentence summary
  body          TEXT NOT NULL DEFAULT '',            -- plain text / simple markdown
  sector        TEXT,                                -- petroleum | electricity | fiscal | …
  edition_no    INT,                                 -- optional link to a bulletin edition
  status        TEXT NOT NULL DEFAULT 'draft',       -- draft | published
  author        TEXT,                                -- byline
  created_by    TEXT,
  published_by  TEXT,
  published_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stories_published ON bulletin_stories(status, published_at DESC);

-- Reader interests. Empty array means "everything", which is what every
-- existing subscriber signed up for.
ALTER TABLE subscribers
  ADD COLUMN IF NOT EXISTS topics TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS name   TEXT;

-- One row per editorial send, so a broadcast is evidenced and repeat sends are
-- visible rather than guessed at.
CREATE TABLE IF NOT EXISTS broadcasts (
  id            SERIAL PRIMARY KEY,
  subject       TEXT NOT NULL,
  body          TEXT NOT NULL,
  topics        TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],  -- empty = all subscribers
  story_id      INT REFERENCES bulletin_stories(id) ON DELETE SET NULL,
  recipients    INT NOT NULL DEFAULT 0,
  delivered     INT NOT NULL DEFAULT 0,
  failed        INT NOT NULL DEFAULT 0,
  sent_by       TEXT,
  sent_at       TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE bulletin_stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE broadcasts       ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_bulletin_stories" ON bulletin_stories USING (true) WITH CHECK (true);
CREATE POLICY "service_role_broadcasts"       ON broadcasts       USING (true) WITH CHECK (true);
