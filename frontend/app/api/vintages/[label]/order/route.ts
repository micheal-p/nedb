import { NextRequest } from "next/server";
import { db } from "@/lib/supabase-server";
import { ok, err } from "@/lib/api-helpers";
import { checkRateLimitDurable } from "@/lib/rate-limit";
import { nextOrderReference } from "@/lib/vintages";

// POST /api/vintages/:label/order — start a purchase.
// With PAYSTACK_SECRET_KEY configured this initialises a Paystack transaction
// and returns the checkout URL; the callback lands on /data/vintages where
// /api/vintages/verify confirms the payment server-side and issues the
// download token. Without the key the order is recorded as an invoice
// request, so sales can start before the payment rail is wired.

export async function POST(req: NextRequest, { params }: { params: Promise<{ label: string }> }) {
  const { label } = await params;
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anon";
  const rl = await checkRateLimitDurable(`vintage-order:${ip}`, 10, 3600);
  if (!rl.allowed) return err("Too many order attempts — try again later.", 429);

  const body = await req.json().catch(() => null);
  const email = String(body?.email ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return err("A valid email address is required.");

  const { data: v } = await db()
    .from("data_vintages")
    .select("id, label, title, price_ngn, is_published")
    .eq("label", label)
    .single();
  if (!v || !v.is_published) return err("Vintage not found", 404);
  const price = Number(v.price_ngn ?? 0);
  if (!(price > 0)) return err("This vintage is free — download it directly.");

  const reference = await nextOrderReference();
  const { error } = await db().from("vintage_orders").insert({
    vintage_id: v.id,
    reference,
    email,
    buyer_name: String(body?.buyer_name ?? "").trim().slice(0, 200) || null,
    organisation: String(body?.organisation ?? "").trim().slice(0, 200) || null,
    amount_ngn: price,
    status: "pending",
  });
  if (error) return err(error.message, 500);

  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret) {
    // No payment rail yet: record the interest, hand back the reference.
    await db().from("vintage_orders").update({ status: "invoice_requested" }).eq("reference", reference);
    return ok({
      reference,
      invoice_requested: true,
      message: `Order ${reference} recorded. NEDB will contact ${email} with payment instructions.`,
    });
  }

  // Paystack references must be alphanumeric with - . =, so the slashes in
  // the NEDB reference are folded to dashes for the gateway only.
  const psRef = reference.replace(/\//g, "-");
  const origin = process.env.SITE_ORIGIN?.trim().replace(/\/+$/, "") || "https://nedb.vercel.app";
  const res = await fetch("https://api.paystack.co/transaction/initialize", {
    method: "POST",
    headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      email,
      amount: Math.round(price * 100),          // kobo
      reference: psRef,
      callback_url: `${origin}/data/vintages?ref=${encodeURIComponent(psRef)}`,
      metadata: { vintage: v.label, nedb_reference: reference },
    }),
    signal: AbortSignal.timeout(15000),
  }).catch(() => null);
  const j = res ? await res.json().catch(() => null) : null;
  if (!res?.ok || !j?.data?.authorization_url) {
    return err("The payment gateway did not respond — the order is saved, please try again shortly.", 502);
  }

  await db().from("vintage_orders").update({ paystack_ref: psRef }).eq("reference", reference);
  return ok({ reference, authorization_url: j.data.authorization_url });
}
