-- ── 050: quarterly bulletin editions ────────────────────────────────────────
-- Run in the Supabase SQL editor after 049.
--
-- A quarter is a real reporting period for energy statistics, not a month
-- rolled up by hand. Fiscal series (CIT, hydrocarbon tax, gas flaring
-- penalties) are registered quarterly, and a Q1 to Q4 comparison is the
-- shape most of this data is actually read in.

ALTER TABLE bulletin_editions
  DROP CONSTRAINT IF EXISTS bulletin_editions_period_kind_check;

ALTER TABLE bulletin_editions
  ADD CONSTRAINT bulletin_editions_period_kind_check
  CHECK (period_kind IN ('month', 'quarter', 'year'));

-- Verify:
--   SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint
--   WHERE conname = 'bulletin_editions_period_kind_check';
