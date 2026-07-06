import { db } from "@/lib/supabase-server";
import { ok, err } from "@/lib/api-helpers";

// GET /api/revisions — public, sanitized revision log.
// Statistical-office practice: every change to published figures is visible.
// Exposes action, series, period, values and timestamp — never usernames.

export async function GET() {
  const { data, error } = await db()
    .from("audit_log")
    .select("action, series_type_id, period, region, old_value, new_value, performed_at, notes")
    .order("performed_at", { ascending: false })
    .limit(100);
  if (error) return err(error.message, 500);

  const rows = (data ?? []).map((r) => ({
    ...r,
    // keep provenance class without exposing account names
    actor: String(r.notes ?? "").includes("OWID") || r.action === "auto_ingest" ? "automated pipeline" : "ECN staff",
    notes: undefined,
  }));
  return ok(rows);
}
