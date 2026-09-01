import { NextRequest } from "next/server";
import { db } from "@/lib/supabase-server";
import { ok, err } from "@/lib/api-helpers";

// GET /api/necal/published/:id — one published pathway with its frozen base.

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { data: r } = await db()
    .from("necal_scenarios")
    .select("id, name, owner_username, scenario, published_base, published_at, is_published")
    .eq("id", id)
    .single();
  if (!r || !r.is_published) return err("Pathway not found", 404);
  return ok({
    id: r.id, name: r.name, published_at: r.published_at,
    scenario: r.scenario, base: r.published_base ?? { generationGwh: 0 },
  });
}
