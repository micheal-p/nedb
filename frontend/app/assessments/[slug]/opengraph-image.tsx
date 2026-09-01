import { ImageResponse } from "next/og";
import { db } from "@/lib/supabase-server";
import { OgCard, coatOfArms, OG_SIZE } from "@/lib/og-card";

// An assessment link unfurls with its title and verified response count, so a
// share into a community group reads as an invitation to a real national
// exercise rather than a bare URL.
export const runtime = "nodejs";
export const alt = "NEDB Energy Needs Assessment";
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  let title = "Energy Needs Assessments";
  let line = "Anonymised open data from field energy assessments across Nigeria.";
  let kicker = "Open data · PENA";

  const { data: form } = await db()
    .from("pena_forms")
    .select("id, title, description, is_public_stats, status")
    .eq("slug", slug)
    .single();
  if (form && form.is_public_stats && form.status !== "draft") {
    title = form.title;
    const { count } = await db()
      .from("pena_responses")
      .select("id", { count: "exact", head: true })
      .eq("form_id", form.id)
      .eq("verify_status", "verified");
    kicker = `Open data · PENA · ${(count ?? 0).toLocaleString()} verified responses`;
    line = form.description ?? line;
    if (line.length > 160) line = line.slice(0, 157) + "…";
  }

  const arms = await coatOfArms();
  return new ImageResponse(<OgCard arms={arms} kicker={kicker} title={title} line={line} />, size);
}
