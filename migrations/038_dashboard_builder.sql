-- ── 038: Dashboard builder — admin-composed custom tabs & widgets ────────────
-- Run in the Supabase SQL editor after 037.
--
-- Lets admins add brand-new tabs to any dashboard PROFILE (every user with
-- that profile) or to a single ACCOUNT, and fill each tab with widgets
-- (charts / KPIs / maps) built from existing energy series — no code deploy.
-- The 21 built-in views stay in code; these tabs are ADDITIVE and render
-- through the generic widget renderer.
--
-- RLS: enabled with NO policies. The app uses the service-role key, which
-- bypasses RLS entirely; adding a world-open "service" policy (the mistake
-- 037 cleaned up) would expose these to the anon key. Leave policy-less.

CREATE TABLE IF NOT EXISTS dashboard_tabs (
  id            BIGSERIAL PRIMARY KEY,
  scope         TEXT NOT NULL CHECK (scope IN ('profile','account')),
  profile_key   TEXT,             -- set when scope = 'profile'
  owner_username TEXT,            -- set when scope = 'account'
  label         TEXT NOT NULL,
  slug          TEXT NOT NULL,
  display_order INT NOT NULL DEFAULT 0,
  created_by    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK ( (scope = 'profile' AND profile_key IS NOT NULL)
       OR (scope = 'account' AND owner_username IS NOT NULL) )
);

CREATE TABLE IF NOT EXISTS dashboard_widgets (
  id            BIGSERIAL PRIMARY KEY,
  tab_id        BIGINT NOT NULL REFERENCES dashboard_tabs(id) ON DELETE CASCADE,
  kind          TEXT NOT NULL CHECK (kind IN ('chart','kpi','map')),
  title         TEXT,
  config        JSONB NOT NULL,   -- { series:[ids], chartType, unit, colors, higherIsBetter }
  display_order INT NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_dash_tabs_profile ON dashboard_tabs(profile_key) WHERE scope = 'profile';
CREATE INDEX IF NOT EXISTS idx_dash_tabs_account ON dashboard_tabs(owner_username) WHERE scope = 'account';
CREATE INDEX IF NOT EXISTS idx_dash_widgets_tab  ON dashboard_widgets(tab_id);

ALTER TABLE dashboard_tabs    ENABLE ROW LEVEL SECURITY;
ALTER TABLE dashboard_widgets ENABLE ROW LEVEL SECURITY;
