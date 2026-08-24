-- ── 045: PENA insight access control and view log ──────────────────────────
-- PENA insights sit on top of personal data: incomes, addresses, coordinates,
-- household circumstances. Until now any authenticated account could open any
-- assessment's insights, and nothing recorded who had looked.
--
-- Two changes:
--   pena_form_access — an explicit grant list per assessment. An assessment
--     marked restricted is visible only to the users granted on it (plus
--     administrators), so a field survey for one agency is not readable by
--     every account on the platform.
--   pena_view_log    — who opened which assessment's identifiable insights and
--     when. Under NDPA 2023 an organisation should be able to say who accessed
--     personal data; "we don't know" is not an answer.

ALTER TABLE pena_forms
  ADD COLUMN IF NOT EXISTS is_restricted BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS owner_agency  TEXT;

CREATE TABLE IF NOT EXISTS pena_form_access (
  id          BIGSERIAL PRIMARY KEY,
  form_id     BIGINT NOT NULL REFERENCES pena_forms(id) ON DELETE CASCADE,
  username    TEXT NOT NULL,
  can_export  BOOLEAN NOT NULL DEFAULT false,
  granted_by  TEXT,
  granted_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (form_id, username)
);

CREATE TABLE IF NOT EXISTS pena_view_log (
  id          BIGSERIAL PRIMARY KEY,
  form_id     BIGINT NOT NULL REFERENCES pena_forms(id) ON DELETE CASCADE,
  username    TEXT NOT NULL,
  action      TEXT NOT NULL DEFAULT 'view',   -- view | export | detail
  identifiable BOOLEAN NOT NULL DEFAULT false, -- did this access include personal fields
  viewed_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pena_view_log_form ON pena_view_log(form_id, viewed_at DESC);
CREATE INDEX IF NOT EXISTS idx_pena_access_form   ON pena_form_access(form_id);

ALTER TABLE pena_form_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE pena_view_log    ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_pena_form_access" ON pena_form_access USING (true) WITH CHECK (true);
CREATE POLICY "service_role_pena_view_log"    ON pena_view_log    USING (true) WITH CHECK (true);
