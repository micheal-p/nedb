import { NextRequest } from "next/server";
import { db } from "@/lib/supabase-server";
import { ok, err } from "@/lib/api-helpers";
import { buildVintage } from "@/lib/vintages";
import { logAudit } from "@/lib/audit";

// Scheduled freeze: on the first of the month (vercel.json cron) the data
// bank freezes and publishes its own edition of record — the release
// calendar's promise kept by a machine instead of a memory. Idempotent: if
// the month's label already exists, nothing happens.

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? "";
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return err("unauthorized", 401);
  }

  const now = new Date();
  const label = `v${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const { data: existing } = await db().from("data_vintages").select("id").eq("label", label).maybeSingle();
  if (existing) return ok({ label, skipped: "already frozen" });

  const build = await buildVintage(label);
  const title = `${now.toLocaleDateString("en-NG", { month: "long", year: "numeric" })} edition`;
  const { error } = await db().from("data_vintages").insert({
    label,
    title,
    notes: "Scheduled monthly edition of record, frozen automatically on the first of the month.",
    snapshot: build.snapshot,
    manifest: build.manifest,
    checksum: build.checksum,
    price_ngn: null,
    is_published: true,
    created_by: "scheduler",
  });
  if (error) return err(error.message, 500);

  await logAudit({
    action: "VINTAGE_FROZEN",
    performed_by: "scheduler",
    notes: `Scheduled freeze: ${label} ("${title}") — sha256:${build.checksum.slice(0, 16)}… published automatically`,
  });
  return ok({ label, checksum: build.checksum, published: true });
}
