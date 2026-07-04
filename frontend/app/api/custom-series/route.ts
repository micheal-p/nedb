import { NextRequest } from "next/server";
import { db } from "@/lib/supabase-server";
import { ok, err, requireAuth } from "@/lib/api-helpers";

// GET /api/custom-series — list all custom series with column counts
export async function GET() {
  const { data, error } = await db()
    .from("custom_series")
    .select("id, slug, name, description, geo_resolution, is_public, created_by, created_at, updated_at, custom_columns(count), custom_records(count)")
    .order("created_at", { ascending: false });

  if (error) return err(error.message, 500);

  const rows = (data ?? []).map((s) => ({
    ...s,
    column_count: (s.custom_columns as { count: number }[])?.[0]?.count ?? 0,
    record_count: (s.custom_records  as { count: number }[])?.[0]?.count ?? 0,
    custom_columns: undefined,
    custom_records: undefined,
  }));

  return ok(rows);
}

// POST /api/custom-series — create a new custom series (admin/staff only)
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth) return err("Unauthorized", 401);

  const body = await req.json().catch(() => null);
  if (!body?.name || !body?.slug)
    return err("name and slug are required", 400);

  const slug = (body.slug as string).toLowerCase().replace(/[^a-z0-9_]/g, "_");

  const { data: series, error: se } = await db()
    .from("custom_series")
    .insert({
      slug,
      name:           body.name,
      description:    body.description   || null,
      what_is:        body.what_is       || null,
      how_to_read:    body.how_to_read   || null,
      why_it_matters: body.why_it_matters || null,
      geo_resolution: body.geo_resolution || "national",
      is_public:      body.is_public     !== false,
      created_by:     auth.username,
    })
    .select("*")
    .single();

  if (se) return err(se.message.includes("unique") ? "A series with this slug already exists" : se.message, se.message.includes("unique") ? 409 : 500);

  // Insert columns if provided
  if (Array.isArray(body.columns) && body.columns.length) {
    const cols = body.columns.map((c: Record<string, unknown>, i: number) => ({
      series_id:     series!.id,
      name:          c.name,
      slug:          (c.slug as string ?? (c.name as string)).toLowerCase().replace(/[^a-z0-9_]/g, "_"),
      column_type:   c.column_type   || "text",
      unit:          c.unit          || null,
      is_required:   c.is_required   !== false,
      is_readonly:   c.column_type   === "cbn_rate",
      config:        c.config        || null,
      display_order: (c.display_order as number) ?? i + 1,
    }));
    const { error: ce } = await db().from("custom_columns").insert(cols);
    if (ce) return err(ce.message, 500);
  }

  return ok(series, 201);
}
