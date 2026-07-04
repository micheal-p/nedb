import { NextRequest } from "next/server";
import { db } from "@/lib/supabase-server";
import { ok, err } from "@/lib/api-helpers";

// GET /api/custom-series/:slug — series detail + columns + recent records
export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const { data: series, error: se } = await db()
    .from("custom_series")
    .select("*")
    .eq("slug", slug)
    .single();

  if (se || !series) return err("Series not found", 404);

  const [{ data: columns }, { data: records, count }] = await Promise.all([
    db()
      .from("custom_columns")
      .select("*")
      .eq("series_id", series.id)
      .order("display_order"),
    db()
      .from("custom_records")
      .select("*", { count: "exact" })
      .eq("series_id", series.id)
      .order("period_date", { ascending: false })
      .limit(200),
  ]);

  return ok({ ...series, columns: columns ?? [], records: records ?? [], total_records: count ?? 0 });
}
