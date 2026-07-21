-- ── 034: PENA v2 — Google sign-in identity, per-form tier tuning, new q-types ─
-- Run in the Supabase SQL editor after 033.

-- How the respondent's email was obtained: 'google' (verified by Google SSO)
-- or 'typed' (manual entry, MX-checked). One-per-IP dedupe uses ip_hash (033).
ALTER TABLE pena_responses ADD COLUMN IF NOT EXISTS email_source TEXT
  CHECK (email_source IN ('google','typed'));

-- Per-form tier thresholds. NULL = the defaults in lib/pena.ts.
-- Shape: {"A":{"light":20,"burden":0.05},"B":{"light":14,"burden":0.10},
--         "C":{"light":8,"burden":0.18},"D":{"light":4,"burden":0.30}}
ALTER TABLE pena_forms ADD COLUMN IF NOT EXISTS tier_config JSONB;

-- New question types: date, multiselect (checkboxes), longtext, rating (1–5)
ALTER TABLE pena_questions DROP CONSTRAINT IF EXISTS pena_questions_qtype_check;
ALTER TABLE pena_questions ADD CONSTRAINT pena_questions_qtype_check
  CHECK (qtype IN ('text','number','select','phone','email','state_ref','lga_ref','address',
                   'date','multiselect','longtext','rating'));
