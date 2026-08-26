-- ── 052: record which migrations have been applied ─────────────────────────
-- Run in the Supabase SQL editor after 051.
--
-- Until now there was no way to answer "has 044 been run?" except by looking
-- for the objects it creates and inferring. With 50-odd files applied by hand,
-- in order, against a production database that holds national statistics, that
-- is not a tenable position: the only record of what had been applied lived in
-- one person's notes.
--
-- Every migration from here is recorded by scripts/migrate.mjs, which refuses
-- to apply a file twice and applies pending files in filename order.
--
-- Everything up to and including 052 is backfilled as applied, and marked as
-- backfilled so nobody later mistakes an inference for an observation. The
-- inference is sound: the objects those files create are present in the schema
-- and the application runs against them.

CREATE TABLE IF NOT EXISTS schema_migrations (
  filename    TEXT PRIMARY KEY,
  applied_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  applied_by  TEXT,
  -- true where the row was inferred at backfill rather than observed at apply
  backfilled  BOOLEAN NOT NULL DEFAULT false,
  checksum    TEXT,
  notes       TEXT
);

ALTER TABLE schema_migrations ENABLE ROW LEVEL SECURITY;
-- No policy. The service role bypasses RLS; nothing else may read this.

-- No rows are seeded here on purpose. An earlier draft of this file seeded
-- three filenames from memory and all three were wrong: the migration series
-- actually begins at 007, so it inserted rows for files that do not exist.
--
-- The backfill is done by the runner, which lists the migrations directory:
--
--   node scripts/migrate.mjs backfill --through 051
--
-- Reading the directory cannot drift from it the way a hardcoded list can.

-- Verify:
--   SELECT filename, applied_at, backfilled FROM schema_migrations ORDER BY filename;
