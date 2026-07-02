-- ── 007: Audit log + Row-Level Security ──────────────────────────────────────

-- Audit log: every insert/update/delete on energy_records is recorded here
CREATE TABLE IF NOT EXISTS audit_log (
  id            BIGSERIAL PRIMARY KEY,
  table_name    TEXT NOT NULL DEFAULT 'energy_records',
  action        TEXT NOT NULL,          -- INSERT | UPDATE | DELETE
  record_id     BIGINT,                 -- energy_records.id
  series_type_id TEXT,
  period        TEXT,
  region        TEXT,
  old_value     NUMERIC,
  new_value     NUMERIC,
  performed_by  TEXT NOT NULL,          -- username from JWT
  performed_at  TIMESTAMPTZ DEFAULT now(),
  notes         TEXT
);

CREATE INDEX idx_audit_record    ON audit_log(record_id);
CREATE INDEX idx_audit_series    ON audit_log(series_type_id);
CREATE INDEX idx_audit_performed ON audit_log(performed_at DESC);

-- ── Row-Level Security ────────────────────────────────────────────────────────
-- We use the service role key in our backend, so RLS does not affect API routes.
-- Enabling RLS means the anon/public key (if ever exposed) cannot read any row.

ALTER TABLE energy_records    ENABLE ROW LEVEL SECURITY;
ALTER TABLE upload_sessions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE series_types      ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_users       ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log         ENABLE ROW LEVEL SECURITY;

-- series_types and energy_records are public-readable (our API serves them publicly)
-- but only via the service role — the anon key gets nothing.
-- Uncomment the lines below if you ever want to expose a Supabase JS client publicly:
-- CREATE POLICY "public read series_types" ON series_types FOR SELECT USING (true);
-- CREATE POLICY "public read energy_records" ON energy_records FOR SELECT USING (true);

-- Add submitted_for_review status to upload workflow
-- (upload_sessions.status can now be: pending | validated | pending_review | committed | rejected)
COMMENT ON COLUMN upload_sessions.status IS
  'pending → validated → pending_review (awaiting admin approval) → committed | rejected';
