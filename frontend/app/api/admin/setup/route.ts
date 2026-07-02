import { NextRequest } from "next/server";
import { db } from "@/lib/supabase-server";
import { requireAdmin, ok, err } from "@/lib/api-helpers";

// POST /api/admin/setup — applies pending migrations (admin only, idempotent)
export async function POST(req: NextRequest) {
  const claims = await requireAdmin(req);
  if (!claims) return err("admin required", 403);

  const client = db();

  try {
    // Create audit_log table if not exists
    await client.rpc("run_sql", {
      sql: `
        CREATE TABLE IF NOT EXISTS audit_log (
          id            BIGSERIAL PRIMARY KEY,
          table_name    TEXT NOT NULL DEFAULT 'energy_records',
          action        TEXT NOT NULL,
          record_id     BIGINT,
          series_type_id TEXT,
          period        TEXT,
          region        TEXT,
          old_value     NUMERIC,
          new_value     NUMERIC,
          performed_by  TEXT NOT NULL,
          performed_at  TIMESTAMPTZ DEFAULT now(),
          notes         TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_audit_record    ON audit_log(record_id);
        CREATE INDEX IF NOT EXISTS idx_audit_series    ON audit_log(series_type_id);
        CREATE INDEX IF NOT EXISTS idx_audit_performed ON audit_log(performed_at DESC);
      `
    });
    return ok({ message: "audit_log table created/confirmed" });
  } catch (e) {
    // rpc may not be available — return SQL for manual execution
    return ok({
      message: "Run this SQL in Supabase SQL editor to create the audit_log table",
      sql: `CREATE TABLE IF NOT EXISTS audit_log (id BIGSERIAL PRIMARY KEY, table_name TEXT NOT NULL DEFAULT 'energy_records', action TEXT NOT NULL, record_id BIGINT, series_type_id TEXT, period TEXT, region TEXT, old_value NUMERIC, new_value NUMERIC, performed_by TEXT NOT NULL, performed_at TIMESTAMPTZ DEFAULT now(), notes TEXT); CREATE INDEX IF NOT EXISTS idx_audit_record ON audit_log(record_id); CREATE INDEX IF NOT EXISTS idx_audit_series ON audit_log(series_type_id);`,
      error: e instanceof Error ? e.message : "unknown",
    });
  }
}
