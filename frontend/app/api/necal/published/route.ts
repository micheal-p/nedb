import { db } from "@/lib/supabase-server";
import { ok, err } from "@/lib/api-helpers";

// GET /api/necal/published — the public shelf of pathways. Read-only by
// construction: the anchor base is the one frozen at publish time, so anyone
// can recompute the pathway and get exactly the published figures.

export async function GET() {
  const { data, error } = await db()
    .from("necal_scenarios")
    .select("id, name, owner_username, scenario, published_at")
    .eq("is_published", true)
    .order("published_at", { ascending: false })
    .limit(100);
  if (error) return err(error.message, 500);
  return ok((data ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    published_at: r.published_at,
    horizon: (r.scenario as { drivers?: { horizon?: number } })?.drivers?.horizon ?? null,
    preset: (r.scenario as { presetId?: string })?.presetId ?? null,
  })));
}
