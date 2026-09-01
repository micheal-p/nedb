import { NextRequest } from "next/server";
import { db } from "@/lib/supabase-server";
import { ok, err } from "@/lib/api-helpers";
import { requireNecal } from "@/lib/necal-access";

// GET  /api/necal/scenarios — the caller's saved scenarios, newest first.
// POST /api/necal/scenarios — save or overwrite by name. A scenario belongs to
//      the account that saved it; the maker's name travels onto everything
//      generated from it.

export async function GET(req: NextRequest) {
  const access = await requireNecal(req);
  if (!access.ok) return err(access.error, access.status);
  const { data, error } = await db()
    .from("necal_scenarios")
    .select("id, name, scenario, is_published, published_at, updated_at")
    .eq("owner_username", access.username)
    .order("updated_at", { ascending: false })
    .limit(100);
  if (error) return err(error.message, 500);
  return ok(data ?? []);
}

export async function POST(req: NextRequest) {
  const access = await requireNecal(req);
  if (!access.ok) return err(access.error, access.status);

  const body = await req.json().catch(() => null);
  const name = String(body?.name ?? "").trim().slice(0, 120);
  if (!name) return err("Give the scenario a name.");
  if (!body?.scenario || body.scenario.v !== 1) return err("A valid scenario payload is required.");

  const { data, error } = await db()
    .from("necal_scenarios")
    .upsert(
      { owner_username: access.username, name, scenario: body.scenario, updated_at: new Date().toISOString() },
      { onConflict: "owner_username,name" }
    )
    .select("id, name, updated_at")
    .single();
  if (error) return err(error.message, 500);
  return ok(data, 201);
}
