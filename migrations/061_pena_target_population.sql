-- ── 061: an assessment says WHO it is for ───────────────────────────────────
-- Run after 060.
--
-- "Household energy survey" describes an instrument; it does not describe a
-- population. A finding is only interpretable against the people it was
-- collected from — rural market traders in Kano and Lagos estate residents
-- produce different tiers for different reasons. Every assessment now
-- declares its target population in words and its setting from a fixed list,
-- and both travel into the public page, the fill form and the working
-- papers' methods section, where "who does this describe" must be answerable.

ALTER TABLE pena_forms
  ADD COLUMN IF NOT EXISTS target_population TEXT,
  ADD COLUMN IF NOT EXISTS setting TEXT
    CHECK (setting IN ('urban', 'peri-urban', 'rural', 'mixed'));

COMMENT ON COLUMN pena_forms.target_population IS
  'Who this assessment is about, in plain words — e.g. "market traders in Kano metropolis" or "off-grid households, Niger Delta riverine communities".';
