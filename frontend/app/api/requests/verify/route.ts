import { NextRequest } from "next/server";
import { db } from "@/lib/supabase-server";
import { ok, err } from "@/lib/api-helpers";
import { checkRateLimitDurable } from "@/lib/rate-limit";

// GET /api/requests/verify?ref=NEDB-DR-2026-00001 — confirm with Paystack,
// check the amount actually charged, mark the request paid. Idempotent.

export async function GET(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anon";
  const rl = await checkRateLimitDurable(`dr-verify:${ip}`, 30, 3600);
  if (!rl.allowed) return err("Too many attempts — try again later.", 429);

  const psRef = new URL(req.url).searchParams.get("ref") ?? "";
  if (!/^NEDB-DR-\d{4}-\d{1,7}$/.test(psRef)) return err("Invalid reference");

  const { data: r } = await db()
    .from("data_requests")
    .select("id, status, price_ngn, paid_at, created_at")
    .eq("paystack_ref", psRef)
    .maybeSingle();
  if (!r) return err("Request not found", 404);

  const year = new Date(r.created_at as string).getFullYear();
  const reference = `NEDB/DR/${year}/${String(r.id).padStart(5, "0")}`;
  if (r.status === "paid" || r.status === "fulfilled") return ok({ status: r.status, reference, paid_at: r.paid_at });

  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret) return err("Payment verification is not configured.", 503);

  const res = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(psRef)}`, {
    headers: { Authorization: `Bearer ${secret}` },
    signal: AbortSignal.timeout(15000),
  }).catch(() => null);
  const j = res ? await res.json().catch(() => null) : null;
  if (!res?.ok || !j?.data) return err("Could not verify the payment yet — try again in a moment.", 502);

  const paid = j.data.status === "success" && Number(j.data.amount) >= Math.round(Number(r.price_ngn ?? 0) * 100);
  if (!paid) return ok({ status: j.data.status === "success" ? "amount_mismatch" : j.data.status, reference });

  const { error } = await db()
    .from("data_requests")
    .update({ status: "paid", paid_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", r.id)
    .eq("status", "quoted");   // one transition wins; re-verifies read the row above
  if (error) return err(error.message, 500);

  return ok({ status: "paid", reference });
}
