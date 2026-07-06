import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase-server";
import { ok, err } from "@/lib/api-helpers";
import { checkRateLimitDurable } from "@/lib/rate-limit";
import { unsubToken } from "@/lib/monthly-report";

// POST /api/subscribe {email} — public newsletter signup (monthly Energy Report).
// GET  /api/subscribe?action=unsub&email=&t= — signed one-click unsubscribe.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anon";
  const rl = await checkRateLimitDurable(`sub:${ip}`, 5, 3600);
  if (!rl.allowed) return err("Too many attempts — try again later", 429);

  const body = await req.json().catch(() => null);
  const email = (body?.email ?? "").toString().trim().toLowerCase().slice(0, 200);
  if (!EMAIL_RE.test(email)) return err("Enter a valid email address", 400);

  const { error } = await db()
    .from("subscribers")
    .upsert({ email, is_active: true, unsubscribed_at: null }, { onConflict: "email" });
  if (error) return err(error.message, 500);

  return ok({ subscribed: true });
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  if (sp.get("action") !== "unsub") return err("Unknown action", 400);
  const email = (sp.get("email") ?? "").toLowerCase();
  const t = sp.get("t") ?? "";
  if (!email || t !== unsubToken(email)) return err("Invalid unsubscribe link", 400);

  await db()
    .from("subscribers")
    .update({ is_active: false, unsubscribed_at: new Date().toISOString() })
    .eq("email", email);

  return new NextResponse(
    `<html><body style="font-family:Arial;max-width:480px;margin:80px auto;text-align:center;color:#0A0A0A">
      <h2 style="color:#0E7A3C">Unsubscribed</h2>
      <p style="color:#5C5650">${email} will no longer receive the NEDB Monthly Energy Report.</p>
      <a href="/" style="color:#0E7A3C;font-weight:700">Back to the Data Bank</a>
    </body></html>`,
    { headers: { "Content-Type": "text/html" } }
  );
}
