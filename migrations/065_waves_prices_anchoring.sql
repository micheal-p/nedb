-- ── 065: waves, reference prices, and anchored citations ────────────────────
-- Run after 064.
--
-- WAVES. Measuring change means asking the same population again. A wave is
-- a linked re-run of an assessment: same questions, its own responses, its
-- parent named — the panel the re-contact permission was collected for.
-- Campaigns get an honest target so the field effort has a number to hit.
--
-- REFERENCE PRICES. The supply side gets its receiving series: PPA tariffs
-- and solar tender capex, collected as data-bank series like any other. The
-- demand side already lives in the assessment responses.
--
-- ANCHORING. Vintages gain a DOI column for the day a DataCite account
-- exists; until then the checksum endpoint and citation exports carry the
-- integrity story.

ALTER TABLE pena_forms
  ADD COLUMN IF NOT EXISTS parent_form_id BIGINT REFERENCES pena_forms(id),
  ADD COLUMN IF NOT EXISTS wave INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS target_responses INTEGER;

ALTER TABLE data_vintages
  ADD COLUMN IF NOT EXISTS doi TEXT;

INSERT INTO series_types (id, name, sector, subsector, unit_default, frequency, viz_types, geo_resolution, is_public, description)
VALUES
  ('ppa_tariff', 'PPA Tariff (Signed)', 'electricity', 'procurement', '₦/kWh', 'monthly', ARRAY['line'], 'national', true,
   'Tariffs of signed power purchase agreements, collected per deal as the Nigerian reference the international planning figures cannot give.'),
  ('solar_capex_tender', 'Solar Tender Capex (Awarded)', 'renewable', 'procurement', 'USD/kW', 'monthly', ARRAY['line'], 'national', true,
   'Awarded solar tender capital cost per kilowatt — measured Nigerian outcomes to replace planning assumptions in NECAL2050.')
ON CONFLICT (id) DO NOTHING;
