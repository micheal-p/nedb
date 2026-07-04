import { NextRequest } from "next/server";
import { db } from "@/lib/supabase-server";
import { ok, err, requireAuth } from "@/lib/api-helpers";

// POST /api/custom-series/:slug/records — insert one or more records
// Auto-fills any column with column_type = 'cbn_rate' from the CBN API
export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const auth = await requireAuth(req);
  if (!auth) return err("Unauthorized", 401);

  const { slug } = await params;

  const { data: series } = await db()
    .from("custom_series")
    .select("id")
    .eq("slug", slug)
    .single();

  if (!series) return err("Series not found", 404);

  const { data: columns } = await db()
    .from("custom_columns")
    .select("slug, column_type, is_required")
    .eq("series_id", series.id)
    .order("display_order");

  const cols = columns ?? [];
  const cbnCol = cols.find((c) => c.column_type === "cbn_rate");

  // Fetch CBN rate if needed
  let cbnRate: number | null = null;
  if (cbnCol) {
    try {
      const base = req.nextUrl.origin;
      const r = await fetch(`${base}/api/cbn-rate`);
      if (r.ok) {
        const j = await r.json();
        cbnRate = j.rate ?? null;
      }
    } catch {
      // leave null — we'll still insert, rate shows as null
    }
  }

  const body = await req.json().catch(() => null);
  if (!body) return err("Invalid JSON", 400);

  const rows: Record<string, unknown>[] = Array.isArray(body) ? body : [body];
  if (!rows.length) return err("No records provided", 400);

  // Validate required fields and inject CBN rate
  const records = rows.map((row) => {
    const data: Record<string, unknown> = { ...row };

    // Auto-inject CBN rate
    if (cbnCol && cbnRate !== null) {
      data[cbnCol.slug] = cbnRate;
    }

    // period_date must be present
    const periodDate = (data.period_date ?? data.date) as string | undefined;
    if (!periodDate) throw new Error("period_date is required on every record");

    return {
      series_id:    series.id,
      period_date:  periodDate,
      region:       (data.region as string) || "NGA",
      lga_id:       (data.lga_id as number) || null,
      data,
      created_by:   auth.username,
    };
  });

  const { error } = await db().from("custom_records").insert(records);
  if (error) return err(error.message, 500);

  return ok({ inserted: records.length, cbn_rate_applied: cbnRate }, 201);
}

// GET /api/custom-series/:slug/records — list records for a series
export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const sp = req.nextUrl.searchParams;
  const page  = Math.max(1, parseInt(sp.get("page")  ?? "1"));
  const limit = Math.min(500, parseInt(sp.get("limit") ?? "100"));

  const { data: series } = await db()
    .from("custom_series")
    .select("id")
    .eq("slug", slug)
    .single();

  if (!series) return err("Series not found", 404);

  const { data, count } = await db()
    .from("custom_records")
    .select("*", { count: "exact" })
    .eq("series_id", series.id)
    .order("period_date", { ascending: false })
    .range((page - 1) * limit, page * limit - 1);

  return ok({ rows: data ?? [], total: count ?? 0, page, limit });
}
