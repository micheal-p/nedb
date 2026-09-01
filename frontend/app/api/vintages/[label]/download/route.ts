import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase-server";
import { err, requireAdmin } from "@/lib/api-helpers";
import { canonicalJson } from "@/lib/vintages";
import { checkRateLimitDurable } from "@/lib/rate-limit";

// GET /api/vintages/:label/download — the frozen document itself.
// Free vintages download openly. A priced vintage needs the download token a
// verified payment issued. Either way the bytes served are the stored
// snapshot verbatim, so hashing the download reproduces the catalogue
// checksum — that check is the product.

export async function GET(req: NextRequest, { params }: { params: Promise<{ label: string }> }) {
  const { label } = await params;
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anon";
  const rl = await checkRateLimitDurable(`vintage-dl:${ip}`, 30, 3600);
  if (!rl.allowed) return err("Too many downloads — try again later.", 429);

  const admin = await requireAdmin(req);
  const { data: v } = await db()
    .from("data_vintages")
    .select("id, label, title, snapshot, checksum, price_ngn, is_published")
    .eq("label", label)
    .single();
  if (!v || (!v.is_published && !admin)) return err("Vintage not found", 404);

  const priced = v.price_ngn != null && Number(v.price_ngn) > 0;
  if (priced && !admin) {
    const token = new URL(req.url).searchParams.get("token") ?? "";
    if (!/^[a-f0-9]{48}$/.test(token)) return err("This vintage is priced — purchase it to receive a download link.", 402);
    const { data: order } = await db()
      .from("vintage_orders")
      .select("id, status")
      .eq("vintage_id", v.id)
      .eq("download_token", token)
      .maybeSingle();
    if (!order || order.status !== "paid") return err("This download link is not valid for this vintage.", 403);
  }

  // The file served is the EXACT canonical serialisation the checksum was
  // computed over — `shasum -a 256 nedb-<label>.json` reproduces the catalogue
  // checksum byte for byte. Embedding the checksum or pretty-printing would
  // break that, so the digest travels in a header instead.
  return new NextResponse(canonicalJson(v.snapshot), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="nedb-${v.label}.json"`,
      "X-NEDB-Checksum": `sha256:${v.checksum}`,
    },
  });
}
