-- ── 062: the NECAL planning workspace ───────────────────────────────────────
-- Run after 061.
--
-- Planners get what planners actually need: named scenarios they can return
-- to, a personal planning folder of saved report files (renameable,
-- shareable, timestamped), a published shelf the public can read, and an
-- honest storage quota — 200MB free, more by request, granted by a
-- superadmin, because "unlimited" is a promise nobody audits.

CREATE TABLE IF NOT EXISTS necal_scenarios (
  id             BIGSERIAL PRIMARY KEY,
  owner_username TEXT NOT NULL,
  name           TEXT NOT NULL,
  scenario       JSONB NOT NULL,             -- the full Scenario object
  is_published   BOOLEAN NOT NULL DEFAULT false,
  -- Published pathways must stay checkable even as the live anchor moves, so
  -- the base the plan was computed against is frozen with it.
  published_base JSONB,
  published_at   TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (owner_username, name)
);

CREATE TABLE IF NOT EXISTS necal_files (
  id             BIGSERIAL PRIMARY KEY,
  owner_username TEXT NOT NULL,
  filename       TEXT NOT NULL,
  scenario       JSONB NOT NULL,             -- frozen at save time
  base           JSONB,                      -- anchor frozen at save time
  briefing       TEXT,                       -- the machine-drafted memo, saved with the file
  bytes          INTEGER NOT NULL,           -- honest stored size
  share_token    TEXT UNIQUE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_necal_files_owner ON necal_files(owner_username);

CREATE TABLE IF NOT EXISTS storage_allocations (
  username   TEXT PRIMARY KEY,
  quota_mb   INTEGER NOT NULL DEFAULT 200,
  granted_by TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS storage_requests (
  id           BIGSERIAL PRIMARY KEY,
  username     TEXT NOT NULL,
  requested_mb INTEGER NOT NULL,
  reason       TEXT,
  status       TEXT NOT NULL DEFAULT 'pending',   -- pending | granted | declined
  decided_by   TEXT,
  decided_at   TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE necal_scenarios     ENABLE ROW LEVEL SECURITY;
ALTER TABLE necal_files         ENABLE ROW LEVEL SECURITY;
ALTER TABLE storage_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE storage_requests    ENABLE ROW LEVEL SECURITY;
