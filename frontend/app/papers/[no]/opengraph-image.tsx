import { ImageResponse } from "next/og";
import { db } from "@/lib/supabase-server";
import { OgCard, coatOfArms, OG_SIZE } from "@/lib/og-card";

// A forwarded working-paper link unfurls as the paper itself: number, title,
// and the abstract's opening line.
export const runtime = "nodejs";
export const alt = "NEDB Working Paper";
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ no: string }> }) {
  const { no } = await params;
  const m = no.match(/^(\d{4})-(\d{2,})$/);
  const paperNo = m ? `NEDB/WP/${m[1]}/${m[2]}` : null;

  let title = "Working Papers";
  let line = "Reproducible findings from the Nigeria Energy Data Bank's field assessments.";
  let kicker = "NEDB Working Paper Series";

  if (paperNo) {
    const { data } = await db()
      .from("working_papers")
      .select("paper_no, title, status, body")
      .eq("paper_no", paperNo)
      .single();
    if (data && data.status === "published") {
      title = data.title;
      kicker = `NEDB Working Paper · ${data.paper_no}`;
      const summary = (data.body as { summary?: string } | null)?.summary;
      if (summary) line = summary.length > 160 ? summary.slice(0, 157) + "…" : summary;
    }
  }

  const arms = await coatOfArms();
  return new ImageResponse(<OgCard arms={arms} kicker={kicker} title={title} line={line} />, size);
}
