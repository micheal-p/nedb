import { NextRequest } from "next/server";
import { randomBytes, createHash } from "node:crypto";
import { db } from "@/lib/supabase-server";
import { ok, err, requireAdmin, requireSuperadmin } from "@/lib/api-helpers";
import { logAudit } from "@/lib/audit";

// Admin management of public API keys.
//
// Two things changed here after the platform audit.
//
// The secret is no longer stored. It used to sit in api_keys.key in clear and
// be selected straight into the admin list, so a database export, a backup, a
// screen share or a screenshot of that page handed over working credentials.
// The key is now shown ONCE, at the moment it is issued, and only its SHA-256
// is kept. Nothing can retrieve it afterwards, including this endpoint.
//
// Issuing and revoking are now recorded. Handing out or withdrawing access to
// the national data bank left no trace at all, on a platform whose whole claim
// is that consequential acts are attributable.

const keyShape = (raw: string) => ({
  key_hash:   createHash("sha256").update(raw).digest("hex"),
  key_prefix: raw.slice(0, 12),
  last_four:  raw.slice(-4),
});

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth) return err("Unauthorized", 401);
  // `key` is deliberately absent: there is nothing to show and, once 055 has
  // run, nothing to select.
  const { data, error } = await db()
    .from("api_keys")
    .select("id, label, owner, key_prefix, last_four, is_active, created_by, created_at, last_used, rate_limit, call_count")
    .order("created_at", { ascending: false });
  if (error) return err(error.message, 500);
  return ok(data ?? []);
}

export async function POST(req: NextRequest) {
  // Issuing a credential for the national data bank is a superadmin act, not a
  // day-to-day administrative one.
  const auth = await requireSuperadmin(req);
  if (!auth) return err("Issuing an API key requires a super administrator.", 403);

  const body = await req.json().catch(() => null);
  if (!body?.label) return err("label is required", 400);

  const raw = `nedb_${randomBytes(18).toString("hex")}`;
  const who = String((auth as { username?: string }).username ?? auth.sub ?? "unknown");

  const { data, error } = await db()
    .from("api_keys")
    .insert({
      ...keyShape(raw),
      label: body.label,
      owner: body.owner ?? null,
      created_by: who,
    })
    .select("id, label, owner, key_prefix, last_four, is_active, created_at, rate_limit")
    .single();
  if (error) return err(error.message, 500);

  await logAudit({
    action: "API_KEY_ISSUE",
    performed_by: who,
    notes: `Issued API key ${data.key_prefix}… to ${body.owner ?? body.label}. The secret was shown once and is not stored.`,
  });

  // The only moment the secret exists outside the caller's browser.
  return ok({ ...data, key: raw, warning: "This is the only time this key is shown. Store it now; it cannot be retrieved." }, 201);
}

export async function PUT(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth) return err("Unauthorized", 401);
  const body = await req.json().catch(() => null);
  if (!body?.id) return err("id is required", 400);

  const active = Boolean(body.is_active);
  const { data, error } = await db()
    .from("api_keys")
    .update({ is_active: active })
    .eq("id", body.id)
    .select("id, label, key_prefix, is_active")
    .single();
  if (error) return err(error.message, 500);

  await logAudit({
    action: active ? "API_KEY_ENABLE" : "API_KEY_REVOKE",
    performed_by: String((auth as { username?: string }).username ?? auth.sub ?? "unknown"),
    notes: `${active ? "Re-enabled" : "Revoked"} API key ${data.key_prefix}… (${data.label}).`,
  });

  return ok(data);
}
