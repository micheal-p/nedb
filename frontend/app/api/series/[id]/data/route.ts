import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase-server";
import { ok } from "@/lib/api-helpers";
import { authorizeApiCall, getPublished, publicColumns } from "@/lib/api-exposure";

// GET /api/series/{id}/data — published records for a published series.
//
// Two changes that matter: an unpublished series returns 404 rather than its
// contents, and the projection is the administrator-defined column list
// instead of SELECT *, which previously handed anonymous callers internal
// review notes and upload-session ids.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeApiCall(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const series = await getPublished(id);
  if (!series) {
    return NextResponse.json({ error: "Series not found or not published for public access." }, { status: 404 });
  }

  const cols = publicColumns(series.public_fields);

  const sp = req.nextUrl.searchParams;
  const page  = Math.max(1, parseInt(sp.get("page")  ?? "1"));
  const limit = Math.min(500, Math.max(1, parseInt(sp.get("limit") ?? "100")));
  const from  = (page - 1) * limit;
  const to    = from + limit - 1;

  let query = db()
    .from("energy_records")
    .select(cols.join(", "), { count: "exact" })
    .eq("series_type_id", id)
    .order("period_date", { ascending: true })
    .range(from, to);

  if (sp.get("region"))      query = query.eq("region", sp.get("region")!);
  if (sp.get("period_from")) query = query.gte("period_date", sp.get("period_from")!);
  if (sp.get("period_to"))   query = query.lte("period_date", sp.get("period_to")!);

  const { data, count } = await query;
  return ok({
    series_id: id,
    fields: cols,
    note: series.public_note ?? undefined,
    rows: data ?? [],
    total: count ?? 0,
    page,
    limit,
  });
}
