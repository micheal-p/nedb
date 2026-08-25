-- ── 048: bulletin editions get a real period, not just a label ──────────────
-- Run in the Supabase SQL editor after 047.
--
-- `period_label` was free text ("August 2026") and nothing filtered on it. An
-- edition titled August 2026 contained whatever the newest record of every
-- series happened to be, which for generation is a 2024 annual total. So the
-- masthead said one month and the figures were from another year, with nothing
-- on the page admitting the difference.
--
-- A period is now a real window the snapshot is built for. Editions can be
-- monthly (the default, this is the Monthly Energy Bulletin) or annual, so a
-- year-in-review edition is a first-class thing rather than a differently
-- worded label.

ALTER TABLE bulletin_editions
  ADD COLUMN IF NOT EXISTS period_kind  TEXT NOT NULL DEFAULT 'month',   -- month | year
  ADD COLUMN IF NOT EXISTS period_start DATE,
  ADD COLUMN IF NOT EXISTS period_end   DATE;

ALTER TABLE bulletin_editions
  DROP CONSTRAINT IF EXISTS bulletin_editions_period_kind_check;
ALTER TABLE bulletin_editions
  ADD CONSTRAINT bulletin_editions_period_kind_check
  CHECK (period_kind IN ('month', 'year'));

-- Backfill existing editions from their label where it parses as "Month YYYY",
-- otherwise leave the window null so the UI shows them as unscoped rather than
-- inventing a period they were never built for.
UPDATE bulletin_editions
SET period_start = date_trunc('month', to_date(period_label, 'FMMonth YYYY'))::date,
    period_end   = (date_trunc('month', to_date(period_label, 'FMMonth YYYY')) + interval '1 month - 1 day')::date,
    period_kind  = 'month'
WHERE period_start IS NULL
  AND period_label ~ '^[A-Za-z]+ [0-9]{4}$';

CREATE INDEX IF NOT EXISTS idx_bulletin_period ON bulletin_editions(period_start DESC);

-- Verify:
--   SELECT edition_no, period_label, period_kind, period_start, period_end
--   FROM bulletin_editions ORDER BY edition_no DESC;
