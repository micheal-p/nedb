import { ImageResponse } from "next/og";
import { db } from "@/lib/supabase-server";
import { OgCard, coatOfArms, OG_SIZE } from "@/lib/og-card";

// The catalogue link unfurls with the newest edition of record and the start
// of its checksum — the product IS the proof, so the preview leads with it.
export const runtime = "nodejs";
export const alt = "NEDB Data Vintages";
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function Image() {
  let kicker = "Editions of record";
  let title = "Data Vintages";
  let line = "The data bank frozen at a moment: checksummed editions that never change, for citation and audit.";

  const { data } = await db()
    .from("data_vintages")
    .select("label, title, checksum")
    .eq("is_published", true)
    .order("created_at", { ascending: false })
    .limit(1);
  if (data?.[0]) {
    kicker = `Editions of record · latest ${data[0].label}`;
    line = `${data[0].title} — sha256:${data[0].checksum.slice(0, 24)}… Verify any download against the catalogue checksum.`;
  }

  const arms = await coatOfArms();
  return new ImageResponse(<OgCard arms={arms} kicker={kicker} title={title} line={line} />, size);
}
