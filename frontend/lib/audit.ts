// ── lib/audit.ts ────────────────────────────────────────────────────────────
// One helper for the audit trail. Every commit, publish, deletion and account
// change writes a line; failures are swallowed so auditing never breaks the
// action itself (the DB insert failing is logged to the server console).

import { db } from "@/lib/supabase-server";

export async function logAudit(entry: {
  action: string;                 // e.g. "INSERT", "DELETE", "USER_CREATE", "ROLE_CHANGE", "BULLETIN_PUBLISH"
  performed_by: string;
  notes?: string;
  series_type_id?: string | null;
  record_id?: number | null;
  period?: string | null;
  region?: string | null;
  old_value?: number | null;
  new_value?: number | null;
}) {
  try {
    await db().from("audit_log").insert({
      action: entry.action,
      series_type_id: entry.series_type_id ?? null,
      record_id: entry.record_id ?? null,
      period: entry.period ?? null,
      region: entry.region ?? null,
      old_value: entry.old_value ?? null,
      new_value: entry.new_value ?? null,
      performed_by: entry.performed_by,
      notes: entry.notes ?? null,
    });
  } catch (e) {
    console.error("audit_log insert failed:", e);
  }
}
