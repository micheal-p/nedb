import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase-server";
import { requireAdmin } from "@/lib/api-helpers";

export async function GET(req: NextRequest) {
  const claims = await requireAdmin(req);
  if (!claims) return NextResponse.json({ error: "admin required" }, { status: 403 });
  const { searchParams } = new URL(req.url);
  const series = searchParams.get("series") ?? null;
  const year   = searchParams.get("year")   ?? null;
  const region = searchParams.get("region") ?? null;
  const q      = searchParams.get("q")?.trim() ?? null;
  const limit  = Math.min(parseInt(searchParams.get("limit") ?? "100"), 500);
  const offset = Math.max(0, parseInt(searchParams.get("offset") ?? "0"));

  // Paged with an exact count so the console can state how many records match
  // rather than silently truncating at a fixed cap.
  let query = db()
    .from("energy_records")
    .select("id, series_type_id, period, period_date, region, value, unit, source, notes, created_at", { count: "exact" })
    .order("period_date", { ascending: false })
    .range(offset, offset + limit - 1);

  if (series) query = query.eq("series_type_id", series);
  if (year)   query = query.gte("period_date", `${year}-01-01`).lte("period_date", `${year}-12-31`);
  if (region) query = query.eq("region", region);
  if (q)      query = query.or(`period.ilike.%${q}%,source.ilike.%${q}%,region.ilike.%${q}%`);

  const { data, error, count } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ records: data ?? [], total: count ?? 0, limit, offset });
}
