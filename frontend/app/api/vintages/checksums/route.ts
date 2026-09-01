import { NextResponse } from "next/server";
import { db } from "@/lib/supabase-server";

// GET /api/vintages/checksums — the anchoring surface: every published
// edition's checksum as plain text, one per line, stable format. Mirror this
// file anywhere (a git repo, a timestamping service, a newspaper notice) and
// even NEDB cannot silently rewrite an edition afterwards. The DOI column
// waits for a DataCite account; the checksums do not wait for anything.

export async function GET() {
  const { data } = await db()
    .from("data_vintages")
    .select("label, checksum, created_at, doi")
    .eq("is_published", true)
    .order("created_at", { ascending: true });

  const lines = [
    "# NEDB data vintage checksums — sha256 over the canonical download bytes",
    "# verify: shasum -a 256 nedb-<label>.json",
    ...(data ?? []).map((v) => `${v.label}  sha256:${v.checksum}  frozen:${String(v.created_at).slice(0, 10)}${v.doi ? `  doi:${v.doi}` : ""}`),
  ];
  return new NextResponse(lines.join("\n") + "\n", {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=300" },
  });
}
