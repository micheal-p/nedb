-- ── 064: specialised administrations ────────────────────────────────────────
-- Run after 063.
--
-- "Admin" was one job. It is now seven, with a superadmin above them all:
--
--   software    — the superadmin's own scope: everything, plus guest view
--   business    — outreach, publications, dashboards, finance
--   technical   — platform health, data plumbing, intelligence surfaces
--   research    — the editorial admin: assessments, papers, bulletins
--   data_entry  — records, terminal, uploads
--   accounting  — the money: orders, quotes, payments
--   audit       — the audit log, and nothing else
--
-- The scope filters which consoles an administrator sees and which scoped
-- APIs answer them. Roles still decide WHAT an account may do; the scope
-- decides WHERE an administrator works. An admin with no scope keeps the
-- full legacy rail, so nothing breaks the day this lands.
--
-- Audit access can also be TIME-BOXED: a superadmin grants any account the
-- audit console until an expiry, for an external review that ends.

ALTER TABLE staff_users
  ADD COLUMN IF NOT EXISTS admin_scope TEXT
    CHECK (admin_scope IN ('software', 'business', 'technical', 'research', 'data_entry', 'accounting', 'audit'));

CREATE TABLE IF NOT EXISTS audit_access_grants (
  username   TEXT PRIMARY KEY,
  expires_at TIMESTAMPTZ NOT NULL,
  granted_by TEXT NOT NULL,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE audit_access_grants ENABLE ROW LEVEL SECURITY;
