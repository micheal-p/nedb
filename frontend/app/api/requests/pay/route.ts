import { NextRequest } from "next/server";
import { db } from "@/lib/supabase-server";
import { ok, err } from "@/lib/api-helpers";
import { checkRateLimitDurable } from "@/lib/rate-limit";
import { parseRef } from "@/lib/dr-ref";

// POST /api/requests/pay — {ref, email}. Starts payment of a quoted request:
// Paystack checkout when the key is configured, an invoice note otherwise.
// Same server-side discipline as vintage orders — the browser never gets to
// assert that anything was paid.

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anon";
  const rl = await checkRateLimitDurable(`dr-pay:${ip}`, 10, 3600);
  if (!rl.allowed) return err("Too many attempts — try again later.", 429);

  const body = await req.json().catch(() => null);
  const id = parseRef(String(body?.ref ?? ""));
  const email = String(body?.email ?? "").trim().toLowerCase();
  if (!id || !email) return err("Reference and email are required.");

  const { data: r } = await db()
    .from("data_requests")
    .select("id, email, status, price_ngn, created_at")
    .eq("id", id)
    .maybeSingle();
  if (!r || r.email !== email) return err("No request matches that reference and email.", 404);
  if (r.status === "paid" || r.status === "fulfilled") return err("This request is already paid.");
  if (r.status !== "quoted") return err("This request has not been quoted yet — check back once the data management unit has priced it.");
  const price = Number(r.price_ngn ?? 0);
  if (!(price > 0)) return err("The fee on this request was waived — no payment is needed.");

  const year = new Date(r.created_at as string).getFullYear();
  const psRef = `NEDB-DR-${year}-${String(r.id).padStart(5, "0")}`;

  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret) {
    return ok({
      invoice_requested: true,
      message: `The processing fee is ₦${price.toLocaleString()}. Online payment is not yet enabled — the data management unit will send payment instructions to ${email}.`,
    });
  }

  const origin = process.env.SITE_ORIGIN?.trim().replace(/\/+$/, "") || "https://nedb.vercel.app";
  const res = await fetch("https://api.paystack.co/transaction/initialize", {
    method: "POST",
    headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      email,
      amount: Math.round(price * 100),
      reference: psRef,
      callback_url: `${origin}/request-data?ref=${encodeURIComponent(psRef)}`,
      metadata: { nedb_reference: `NEDB/DR/${year}/${String(r.id).padStart(5, "0")}` },
    }),
    signal: AbortSignal.timeout(15000),
  }).catch(() => null);
  const j = res ? await res.json().catch(() => null) : null;
  if (!res?.ok || !j?.data?.authorization_url) {
    return err("The payment gateway did not respond — please try again shortly.", 502);
  }

  await db().from("data_requests").update({ paystack_ref: psRef, updated_at: new Date().toISOString() }).eq("id", r.id);
  return ok({ authorization_url: j.data.authorization_url });
}
