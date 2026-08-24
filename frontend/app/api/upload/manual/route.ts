import { NextRequest } from "next/server";
import { db } from "@/lib/supabase-server";
import { ok, err, requireRole, roleRank } from "@/lib/api-helpers";
import { commitRecords, type IncomingRecord } from "@/lib/commit-records";

// POST /api/upload/manual — hand-keyed records.
//
// This route used to accept any authenticated caller (a viewer included) and
// write straight to committed records: no review, no freeze check, no audit,
// no anomaly detection. It now follows exactly the same maker-checker path as
// a file upload — editors stage for approval, admins commit — and writes
// through lib/commit-records so the guarantees are identical.
export async function POST(req: NextRequest) {
  const auth = await requireRole(req, "editor");
  if (!auth) return err("Editor access or above is required to enter data", 403);

  const body = await req.json().catch(() => null);
  if (!body?.series_type_id || !Array.isArray(body?.rows) || !body.rows.length)
    return err("series_type_id and rows[] are required", 400);

  const { data: series } = await db()
    .from("series_types")
    .select("id, unit_default")
    .eq("id", body.series_type_id)
    .single();
  if (!series) return err("series not found", 404);

  const isChecker = roleRank((auth as { role?: string }).role) >= roleRank("admin");
  const who = String(auth.username ?? auth.sub ?? "unknown");

  const { data: session, error: se } = await db()
    .from("upload_sessions")
    .insert({
      series_type_id: body.series_type_id,
      filename: "manual-entry",
      row_count: body.rows.length,
      error_count: 0,
      status: isChecker ? "committed" : "pending_review",
      uploaded_by: who,
    })
    .select("id")
    .single();
  if (se) return err(se.message, 500);

  const records: IncomingRecord[] = body.rows.map((r: Record<string, unknown>) => ({
    series_type_id: body.series_type_id,
    period: r.period as string,
    period_date: r.period_date as string,
    region: (r.region as string) || "NGA",
    lga_id: (r.lga_id as number) || null,
    value: Number(r.value),
    unit: (r.unit as string) || series.unit_default,
    source: (r.source as string) || null,
    notes: (r.notes as string) || null,
    methodology_version: "v1",
    upload_session_id: session!.id,
  }));

  // Maker: stage the rows on the session for an admin to approve. Nothing
  // reaches energy_records until a checker signs off.
  if (!isChecker) {
    await db().from("upload_sessions").update({ validated_rows: records }).eq("id", session!.id);
    return ok({
      pending_review: true,
      session_id: session!.id,
      staged_rows: records.length,
      message: "Submitted for admin approval — entries publish once approved.",
    }, 202);
  }

  const result = await commitRecords(records, {
    performedBy: who,
    reason: "Manual entry",
    sessionId: session!.id,
  });

  if (!result.ok) {
    await db().from("upload_sessions").update({ status: "rejected" }).eq("id", session!.id);
    return err(result.error, 409);
  }

  return ok({
    committed_rows: result.inserted,
    replaced_rows: result.replaced,
    session_id: session!.id,
    message: result.replaced
      ? `${result.inserted} record${result.inserted === 1 ? "" : "s"} committed, ${result.replaced} existing value${result.replaced === 1 ? "" : "s"} replaced and logged to the revision log.`
      : `${result.inserted} record${result.inserted === 1 ? "" : "s"} committed.`,
  }, 201);
}
