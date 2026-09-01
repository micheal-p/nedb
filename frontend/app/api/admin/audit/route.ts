import { NextRequest } from "next/server";
import { db } from "@/lib/supabase-server";
import { requireAdmin, ok, err } from "@/lib/api-helpers";

// GET /api/admin/audit — the evidence that the governance exists.
//
// This used to return the newest 200 rows with three exact-match filters and no
// count, which is enough to glance at and not enough to answer a question. An
// auditor asks things like "everything this person did in March", "every time a
// period was unfrozen", "every change to crude oil production last year" — and
// then asks for it as a file. None of that was possible.
//
// Now: filter by person, action, series, record and date range, paginate with a
// true total, and export the whole filtered set as CSV rather than the page.

export const dynamic = "force-dynamic";

const COLUMNS =
  "id, action, table_name, record_id, series_type_id, period, region, old_value, new_value, performed_by, performed_at, notes";

/** RFC 4180: quote everything, double any inner quote. Never trust a value. */
function csvCell(v: unknown): string {
  if (v === null || v === undefined) return '""';
  const s = String(v);
  // A leading =, +, - or @ is interpreted as a formula by spreadsheet software.
  // Audit notes are written by people, so this is a real path to a nasty file.
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return `"${safe.replace(/"/g, '""')}"`;
}

async function auditAllowed(claims: { role?: string; admin_scope?: string | null; username?: string; sub?: string }): Promise<boolean> {
  if (claims.role === "superadmin") return true;
  const scope = claims.admin_scope ?? null;
  if (claims.role === "admin" && (scope === null || scope === "software" || scope === "technical" || scope === "audit")) return true;
  // Time-boxed grant: any account a superadmin has admitted, until expiry.
  const username = String(claims.username ?? claims.sub ?? "");
  if (!username) return false;
  const { data: g } = await db()
    .from("audit_access_grants").select("expires_at").eq("username", username).maybeSingle();
  return !!g && new Date(g.expires_at).getTime() > Date.now();
}

export async function GET(req: NextRequest) {
  const claims = await requireAdmin(req);
  if (!claims) return err("admin required", 403);
  if (!(await auditAllowed(claims))) {
    return err("The audit console is scoped: software, technical and audit administrations hold it, or a time-boxed grant from a super administrator.", 403);
  }

  const p = new URL(req.url).searchParams;
  const series   = p.get("series")?.trim() ?? "";
  const action   = p.get("action")?.trim() ?? "";
  const person   = p.get("person")?.trim() ?? "";
  const recordId = p.get("record")?.trim() ?? "";
  const from     = p.get("from")?.trim() ?? "";
  const to       = p.get("to")?.trim() ?? "";
  const format   = p.get("format") === "csv" ? "csv" : "json";

  const page  = Math.max(1, parseInt(p.get("page") ?? "1", 10) || 1);
  const limit = Math.min(Math.max(1, parseInt(p.get("limit") ?? "100", 10) || 100), 500);

  const build = () => {
    let q = db()
      .from("audit_log")
      .select(COLUMNS, { count: "exact" })
      .order("performed_at", { ascending: false });

    if (series)   q = q.eq("series_type_id", series);
    if (action)   q = q.eq("action", action);
    if (recordId) q = q.eq("record_id", Number(recordId));
    // Partial match on the person, because an auditor knows a name, not a
    // username, and case should not decide whether they find it.
    if (person)   q = q.ilike("performed_by", `%${person}%`);
    if (from)     q = q.gte("performed_at", `${from}T00:00:00Z`);
    // Inclusive of the end date: "to 31 March" must include 31 March.
    if (to)       q = q.lte("performed_at", `${to}T23:59:59.999Z`);
    return q;
  };

  // ── CSV: the whole filtered set, not the page on screen ──────────────────
  if (format === "csv") {
    const CAP = 20000;
    const { data, error, count } = await build().range(0, CAP - 1);
    if (error) return err(error.message, 500);

    const header = ["id","action","table","record_id","series","period","region","old_value","new_value","performed_by","performed_at","notes"];
    const lines = [header.map(csvCell).join(",")];
    for (const r of data ?? []) {
      lines.push([
        r.id, r.action, r.table_name, r.record_id, r.series_type_id, r.period, r.region,
        r.old_value, r.new_value, r.performed_by, r.performed_at, r.notes,
      ].map(csvCell).join(","));
    }
    // Say so in the file rather than silently truncating an audit export.
    if ((count ?? 0) > CAP) {
      lines.push("");
      lines.push(csvCell(`TRUNCATED: ${count} entries matched, ${CAP} exported. Narrow the date range and export again.`));
    }

    const stamp = new Date().toISOString().slice(0, 10);
    return new Response("﻿" + lines.join("\r\n"), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="nedb-audit-${stamp}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  }

  const fromIdx = (page - 1) * limit;
  const { data, error, count } = await build().range(fromIdx, fromIdx + limit - 1);
  if (error) return err(error.message, 500);

  return ok({
    entries: data ?? [],
    total: count ?? 0,
    page,
    limit,
    pages: Math.max(1, Math.ceil((count ?? 0) / limit)),
  });
}
