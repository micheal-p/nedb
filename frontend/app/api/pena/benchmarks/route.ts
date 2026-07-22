import { NextRequest } from "next/server";
import { db } from "@/lib/supabase-server";
import { ok, err, requireAdmin } from "@/lib/api-helpers";
import { DEFAULT_NBS_ROWS } from "@/lib/nbs-benchmarks";

// GET /api/pena/benchmarks — NBS reference rows (public: they are published
// national statistics). Falls back to the built-in defaults until the
// nbs_benchmarks table (migration 036) exists and has rows.
// PUT — admin-only upsert of edited rows from /admin/pena/benchmarks.

export async function GET() {
  const { data, error } = await db()
    .from("nbs_benchmarks")
    .select("state_name, lga_name, population, poverty_rate, source, updated_at")
    .order("state_name");
  if (error || !data?.length) return ok({ rows: DEFAULT_NBS_ROWS, from_defaults: true });
  return ok({ rows: data, from_defaults: false });
}

export async function PUT(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth) return err("Forbidden", 403);

  const body = await req.json().catch(() => null);
  if (!Array.isArray(body?.rows)) return err("rows array required");

  const rows = body.rows.map((r: Record<string, unknown>) => ({
    state_name: String(r.state_name ?? "").trim(),
    lga_name: String(r.lga_name ?? "").trim(),
    population: r.population == null || r.population === "" ? null : Math.round(Number(r.population)),
    poverty_rate: r.poverty_rate == null || r.poverty_rate === "" ? null : Number(r.poverty_rate),
    source: (r.source as string)?.trim() || null,
    updated_by: auth.username,
    updated_at: new Date().toISOString(),
  }));
  if (rows.some((r: { state_name: string }) => !r.state_name)) return err("Every row needs a state_name");
  if (rows.some((r: { population: number | null }) => r.population != null && (!isFinite(r.population) || r.population < 0)))
    return err("Population must be a non-negative number");
  if (rows.some((r: { poverty_rate: number | null }) => r.poverty_rate != null && (!isFinite(r.poverty_rate) || r.poverty_rate < 0 || r.poverty_rate > 100)))
    return err("Poverty rate must be between 0 and 100");

  const { error } = await db()
    .from("nbs_benchmarks")
    .upsert(rows, { onConflict: "state_name,lga_name" });
  if (error) return err(error.message.includes("does not exist") ? "Run migration 036 first — the nbs_benchmarks table is missing." : error.message, 500);

  return ok({ success: true, saved: rows.length });
}
