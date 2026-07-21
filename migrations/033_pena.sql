-- ── 033: PENA — Profiling & Energy Needs Assessment ──────────────────────────
-- Google-Forms-style assessment builder. Admins create a form from the admin
-- dashboard, share a public link (/f/<token>), and respondents fill it in.
-- Responses are geocoded (state / LGA / lat-lng from an address or landmark),
-- classified into an environmental-economic tier (A–E), and analysed on the
-- Data Point side. ONLY k-anonymised aggregates are ever exposed publicly —
-- names, phones, addresses and coordinates never leave the staff side (NDPA 2023).
--
-- Three tables, mirroring the custom_series/custom_columns/custom_records pattern:
--   pena_forms      — the form header (title, share token, status, consent text)
--   pena_questions  — question definitions per form (type, options, analytics key)
--   pena_responses  — submissions (answers as JSONB + extracted analytics columns)

-- ── pena_forms ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pena_forms (
  id              BIGSERIAL PRIMARY KEY,
  slug            TEXT NOT NULL UNIQUE,      -- public aggregate identifier, e.g. lagos_offgrid_2026
  share_token     TEXT NOT NULL UNIQUE,      -- unguessable respondent-link token (/f/<token>)
  title           TEXT NOT NULL,
  description     TEXT,
  consent_text    TEXT NOT NULL,             -- shown to respondents; must be accepted before submit
  status          TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','open','closed')),
  is_public_stats BOOLEAN NOT NULL DEFAULT true,  -- publish k-anonymised aggregates to the open data bank
  created_by      TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── pena_questions ────────────────────────────────────────────────────────────
-- qtype controls rendering + validation on the public form:
--   text / number / select / phone / email — plain inputs
--   state_ref — state picker (ISO 3166-2:NG)
--   lga_ref   — searchable LGA picker backed by the lgas table
--   address   — free text with geocode autocomplete (OSM Nominatim, NG-bounded)
-- analytics_key ties an answer to the insight engine regardless of label edits:
--   full_name | phone | income | light_hours | energy_expense | energy_source | household_size
-- is_pii marks answers that must never appear in any public output.

CREATE TABLE IF NOT EXISTS pena_questions (
  id            BIGSERIAL PRIMARY KEY,
  form_id       BIGINT NOT NULL REFERENCES pena_forms(id) ON DELETE CASCADE,
  label         TEXT NOT NULL,
  slug          TEXT NOT NULL,               -- field key in pena_responses.answers JSONB
  qtype         TEXT NOT NULL DEFAULT 'text'
    CHECK (qtype IN ('text','number','select','phone','email','state_ref','lga_ref','address')),
  unit          TEXT,                        -- e.g. "₦/month", "hours/day"
  is_required   BOOLEAN NOT NULL DEFAULT true,
  is_pii        BOOLEAN NOT NULL DEFAULT false,
  analytics_key TEXT,                        -- NULL for free-form questions
  config        JSONB,                       -- select: {"options":[...]}; number: {"min":0,"max":24}
  display_order INT NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (form_id, slug)
);

-- ── pena_responses ────────────────────────────────────────────────────────────
-- answers holds every field keyed by question slug. The analytics columns
-- (income, light_hours, energy_expense) and geography (state, LGA, lat/lng)
-- are extracted at submit time for fast filtering — same idea as
-- custom_records.period_date. tier is computed server-side at submit time.

CREATE TABLE IF NOT EXISTS pena_responses (
  id             BIGSERIAL PRIMARY KEY,
  form_id        BIGINT NOT NULL REFERENCES pena_forms(id) ON DELETE CASCADE,
  answers        JSONB NOT NULL,
  state_code     TEXT,                       -- ISO 3166-2:NG, e.g. NG-LA
  state_name     TEXT,
  lga_id         BIGINT REFERENCES lgas(id),
  lga_name       TEXT,
  email          TEXT,                       -- one submission per email per form (enforced below)
  address_text   TEXT,
  lat            DOUBLE PRECISION,
  lng            DOUBLE PRECISION,
  geocode_source TEXT,                       -- 'respondent' (picked a suggestion) | 'server' | NULL
  income         NUMERIC,                    -- ₦/month
  light_hours    NUMERIC,                    -- avg hours of electricity per day
  energy_expense NUMERIC,                    -- ₦/month
  tier           TEXT
    CHECK (tier IN ('A','B','C','D','E')),   -- NULL = unclassified (missing inputs)
  consent_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip_hash        TEXT,                       -- sha256(ip) — dedupe/abuse only, never shown
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pena_responses_form    ON pena_responses(form_id);
CREATE INDEX IF NOT EXISTS idx_pena_responses_lga     ON pena_responses(form_id, lga_id) WHERE lga_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pena_responses_state   ON pena_responses(form_id, state_code);
CREATE INDEX IF NOT EXISTS idx_pena_responses_tier    ON pena_responses(form_id, tier);
CREATE INDEX IF NOT EXISTS idx_pena_responses_answers ON pena_responses USING GIN(answers);
CREATE INDEX IF NOT EXISTS idx_pena_forms_token       ON pena_forms(share_token);

-- Anti-abuse: one response per email address per form (Google-Forms-style
-- "limit to 1 response"), case-insensitive. Enforced by the DB, not just the UI.
CREATE UNIQUE INDEX IF NOT EXISTS idx_pena_responses_one_per_email
  ON pena_responses(form_id, lower(email)) WHERE email IS NOT NULL;

-- ── RLS ───────────────────────────────────────────────────────────────────────
-- Responses contain PII, so unlike custom_* there are NO public-read policies.
-- All access goes through the API (service role), which enforces auth in code
-- and strips PII from public aggregate endpoints.
ALTER TABLE pena_forms     ENABLE ROW LEVEL SECURITY;
ALTER TABLE pena_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE pena_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_pena_forms"     ON pena_forms     USING (true) WITH CHECK (true);
CREATE POLICY "service_role_pena_questions" ON pena_questions USING (true) WITH CHECK (true);
CREATE POLICY "service_role_pena_responses" ON pena_responses USING (true) WITH CHECK (true);
