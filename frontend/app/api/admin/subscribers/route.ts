import { NextRequest } from "next/server";
import { db } from "@/lib/supabase-server";
import { ok, err, requireAuth } from "@/lib/api-helpers";

// Admin: list subscribers, toggle active state.

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth) return err("Unauthorized", 401);
  const { data, error } = await db()
    .from("subscribers")
    .select("id, email, is_active, subscribed_at, unsubscribed_at")
    .order("subscribed_at", { ascending: false })
    .limit(500);
  if (error) return err(error.message, 500);
  return ok(data ?? []);
}

export async function PUT(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth) return err("Unauthorized", 401);
  const body = await req.json().catch(() => null);
  if (!body?.id) return err("id required", 400);
  const { error } = await db()
    .from("subscribers")
    .update({
      is_active: Boolean(body.is_active),
      unsubscribed_at: body.is_active ? null : new Date().toISOString(),
    })
    .eq("id", body.id);
  if (error) return err(error.message, 500);
  return ok({ updated: true });
}
