import { NextRequest } from "next/server";
import { randomBytes } from "node:crypto";
import { db } from "@/lib/supabase-server";
import { ok, err, requireAuth } from "@/lib/api-helpers";

// Admin management of public API keys (issue / list / toggle).

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth) return err("Unauthorized", 401);
  const { data, error } = await db()
    .from("api_keys")
    .select("id, key, label, owner, is_active, created_by, created_at, last_used")
    .order("created_at", { ascending: false });
  if (error) return err(error.message, 500);
  return ok(data ?? []);
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth) return err("Unauthorized", 401);
  const body = await req.json().catch(() => null);
  if (!body?.label) return err("label is required", 400);

  const key = `nedb_${randomBytes(18).toString("hex")}`;
  const { data, error } = await db()
    .from("api_keys")
    .insert({ key, label: body.label, owner: body.owner ?? null, created_by: (auth as { username?: string }).username ?? "admin" })
    .select("*")
    .single();
  if (error) return err(error.message, 500);
  return ok(data, 201);
}

export async function PUT(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth) return err("Unauthorized", 401);
  const body = await req.json().catch(() => null);
  if (!body?.id) return err("id is required", 400);
  const { data, error } = await db()
    .from("api_keys")
    .update({ is_active: Boolean(body.is_active) })
    .eq("id", body.id)
    .select("id, is_active")
    .single();
  if (error) return err(error.message, 500);
  return ok(data);
}
