-- ── 053: provisional, revised, final ────────────────────────────────────────
-- Run after 052.
--
-- Every figure in the data bank is currently presented with identical
-- authority. A number published three weeks after the month closed and a number
-- that has been through reconciliation and will not change again look exactly
-- the same to a reader.
--
-- That is not a cosmetic gap. Publishing early and revising later is normal,
-- correct statistical practice; what makes it defensible is saying which state
-- a figure is in at the moment it is read. Without it, every revision looks
-- like an error rather than a process working as designed.
--
--   provisional  published early, expected to change
--   revised      has been changed at least once since first publication
--   final        will not change again, barring a formal correction
--
-- Default is 'final' rather than 'provisional', deliberately. The 150 records
-- already in the bank are historical annual figures from Ember, FAOSTAT, NBS
-- and IRENA that are not awaiting revision. Defaulting them to provisional
-- would put a caveat on 150 figures that do not warrant one, which is its own
-- kind of dishonesty.

ALTER TABLE energy_records
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'final',
  -- when the figure first appeared, as distinct from when the row was written
  ADD COLUMN IF NOT EXISTS first_published_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS revision_count INT NOT NULL DEFAULT 0;

ALTER TABLE energy_records
  DROP CONSTRAINT IF EXISTS energy_records_status_check;
ALTER TABLE energy_records
  ADD CONSTRAINT energy_records_status_check
  CHECK (status IN ('provisional', 'revised', 'final'));

-- Existing rows were first published when they were created.
UPDATE energy_records
SET first_published_at = created_at
WHERE first_published_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_records_status ON energy_records(status);

COMMENT ON COLUMN energy_records.status IS
  'provisional = published early and expected to change; revised = changed since first publication; final = will not change again barring a formal correction';

-- Verify:
--   SELECT status, count(*) FROM energy_records GROUP BY status;
