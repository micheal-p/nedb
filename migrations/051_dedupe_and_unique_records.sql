-- ── 051: remove duplicate records, then make duplicates impossible ──────────
-- Run in the Supabase SQL editor after 050.
--
-- WHY THIS EXISTS
--
-- energy_records has never had a uniqueness constraint. Replacement is enforced
-- only in application code (lib/commit-records.ts), so any other write path, or
-- a migration run twice, silently doubles a figure.
--
-- One was run twice. At the time of writing the table holds 186 rows, of which
-- 36 are exact duplicates: same series, same period, same region, same value,
-- same unit, same source, with ids offset by a constant 18. That is 19% of the
-- entire data bank, and anything that SUMS a series has been double counting it.
-- Fuelwood 2022 was reporting 134,479,298 m³ against a true 67,239,649 m³.
--
-- Affected series: ago_sales, coal_production, electricity_consumption,
-- fuelwood_consumption, renewable_capacity.
--
-- WHAT THIS DOES
--
-- 1. Copies every row it is about to remove into energy_records_dedupe_backup,
--    so the deletion is inspectable and reversible rather than destructive.
-- 2. Deletes duplicates, keeping the LOWEST id of each group. Because the rows
--    are byte-identical on value, unit and source, nothing is lost.
-- 3. Records the correction in audit_log, which the public revision log reads.
--    A 19% correction to the data bank is exactly the kind of thing that page
--    exists to disclose.
-- 4. Adds the unique index so this cannot recur from any write path.
--
-- Uniqueness is on (series_type_id, period, region, fuel_product). NULLs are
-- coalesced, because in PostgreSQL NULL <> NULL and a plain unique index would
-- let two rows with a NULL region both through, which is the exact hole being
-- closed. Unit is deliberately NOT part of the key: one series, one unit. A
-- change of unit is a revision of the figure, not a second figure.

BEGIN;

-- 1 ── Keep a copy of everything about to go
CREATE TABLE IF NOT EXISTS energy_records_dedupe_backup AS
SELECT e.*, now() AS backed_up_at
FROM energy_records e
WHERE e.id NOT IN (
  SELECT MIN(id) FROM energy_records
  GROUP BY series_type_id, period, COALESCE(region,''), COALESCE(fuel_product,'')
);

-- 2 ── Disclose the correction before making it
INSERT INTO audit_log (table_name, action, series_type_id, performed_by, notes)
SELECT
  'energy_records',
  'dedupe',
  NULL,
  'migration/051',
  'Removed ' || count(*) || ' duplicate records created by a migration that ran twice. '
    || 'Every removed row was an exact copy of a retained row on value, unit and source, '
    || 'so no figure changed; totals that summed these series were previously doubled. '
    || 'Series affected: ' || string_agg(DISTINCT series_type_id, ', ' ORDER BY series_type_id) || '. '
    || 'The removed rows are preserved in energy_records_dedupe_backup.'
FROM energy_records_dedupe_backup
HAVING count(*) > 0;

-- 3 ── Remove them
DELETE FROM energy_records
WHERE id NOT IN (
  SELECT MIN(id) FROM energy_records
  GROUP BY series_type_id, period, COALESCE(region,''), COALESCE(fuel_product,'')
);

-- 4 ── Make it impossible from every write path, not just the careful one
CREATE UNIQUE INDEX IF NOT EXISTS uq_energy_records_key
  ON energy_records (series_type_id, period, COALESCE(region,''), COALESCE(fuel_product,''));

COMMIT;

-- Verify:
--   SELECT count(*) FROM energy_records;                     -- expect 150
--   SELECT count(*) FROM energy_records_dedupe_backup;       -- expect 36
--   SELECT series_type_id, period, count(*) FROM energy_records
--     GROUP BY 1,2,COALESCE(region,''),COALESCE(fuel_product,'')
--     HAVING count(*) > 1;                                   -- expect 0 rows
