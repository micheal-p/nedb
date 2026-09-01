// ── lib/necal-storage.ts ────────────────────────────────────────────────────
// Planning-folder usage against the caller's quota. 200MB free by default;
// a superadmin can raise it through the storage console.

import { db } from "@/lib/supabase-server";

export const DEFAULT_QUOTA_MB = 200;

export async function usageFor(username: string): Promise<{ usedBytes: number; quotaMb: number }> {
  const [{ data: files }, { data: alloc }] = await Promise.all([
    db().from("necal_files").select("bytes").eq("owner_username", username),
    db().from("storage_allocations").select("quota_mb").eq("username", username).maybeSingle(),
  ]);
  return {
    usedBytes: (files ?? []).reduce((s, f) => s + (f.bytes ?? 0), 0),
    quotaMb: alloc?.quota_mb ?? DEFAULT_QUOTA_MB,
  };
}
