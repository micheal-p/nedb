import { NextRequest } from "next/server";
import { db } from "@/lib/supabase-server";
import { ok, err } from "@/lib/api-helpers";
import { checkRateLimitDurable } from "@/lib/rate-limit";
import { parseRef } from "@/lib/dr-ref";

// GET /api/requests/track?ref=NEDB/DR/2026/00001&email=… — a requester checks
// their own request. The email must match the row: the reference alone is
// guessable (it is sequential by design), the pair is not, and nothing here
// leaks to someone holding only the reference.

export async function GET(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anon";
  const rl = await checkRateLimitDurable(`dr-track:${ip}`, 20, 3600);
  if (!rl.allowed) return err("Too many lookups — try again later.", 429);

  const sp = new URL(req.url).searchParams;
  const id = parseRef(sp.get("ref") ?? "");
  const email = (sp.get("email") ?? "").trim().toLowerCase();
  if (!id || !email) return err("Reference and email are required.");

  const { data: r } = await db()
    .from("data_requests")
    .select("id, email, status, price_ngn, quote_note, paid_at, created_at, admin_notes")
    .eq("id", id)
    .maybeSingle();
  if (!r || r.email !== email) return err("No request matches that reference and email.", 404);

  const year = new Date(r.created_at as string).getFullYear();
  return ok({
    reference: `NEDB/DR/${year}/${String(r.id).padStart(5, "0")}`,
    status: r.status,
    price_ngn: r.price_ngn,
    quote_note: r.quote_note,
    paid_at: r.paid_at,
    admin_notes: r.status === "declined" ? r.admin_notes : null,
  });
}
