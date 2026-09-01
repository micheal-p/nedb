import { NextRequest } from "next/server";
import { randomBytes } from "node:crypto";
import { db } from "@/lib/supabase-server";
import { ok, err } from "@/lib/api-helpers";
import { checkRateLimitDurable } from "@/lib/rate-limit";

// GET /api/vintages/verify?ref=… — confirm a Paystack payment server-side and
// issue the download token. The gateway's word is never taken from the
// browser: this route asks Paystack directly, checks the amount actually
// charged against the order, and only then marks it paid. Idempotent — the
// callback page can call it repeatedly and gets the same token back.

export async function GET(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anon";
  const rl = await checkRateLimitDurable(`vintage-verify:${ip}`, 30, 3600);
  if (!rl.allowed) return err("Too many attempts — try again later.", 429);

  const psRef = new URL(req.url).searchParams.get("ref") ?? "";
  if (!/^[A-Za-z0-9.=-]{6,64}$/.test(psRef)) return err("Invalid reference");

  const { data: order } = await db()
    .from("vintage_orders")
    .select("id, reference, status, amount_ngn, download_token, vintage_id, data_vintages(label, title)")
    .eq("paystack_ref", psRef)
    .maybeSingle();
  if (!order) return err("Order not found", 404);

  const vintage = order.data_vintages as unknown as { label: string; title: string } | null;
  if (order.status === "paid" && order.download_token) {
    return ok({ status: "paid", reference: order.reference, label: vintage?.label, download_token: order.download_token });
  }

  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret) return err("Payment verification is not configured.", 503);

  const res = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(psRef)}`, {
    headers: { Authorization: `Bearer ${secret}` },
    signal: AbortSignal.timeout(15000),
  }).catch(() => null);
  const j = res ? await res.json().catch(() => null) : null;
  if (!res?.ok || !j?.data) return err("Could not verify the payment yet — try again in a moment.", 502);

  const paid = j.data.status === "success" && Number(j.data.amount) >= Math.round(Number(order.amount_ngn) * 100);
  if (!paid) return ok({ status: j.data.status === "success" ? "amount_mismatch" : j.data.status, reference: order.reference });

  const token = randomBytes(24).toString("hex");
  const { error } = await db()
    .from("vintage_orders")
    .update({ status: "paid", paid_at: new Date().toISOString(), download_token: token })
    .eq("id", order.id)
    .eq("status", "pending");   // idempotency guard: only one transition wins
  if (error) return err(error.message, 500);

  const { data: fresh } = await db().from("vintage_orders").select("download_token").eq("id", order.id).single();
  return ok({ status: "paid", reference: order.reference, label: vintage?.label, download_token: fresh?.download_token ?? token });
}
