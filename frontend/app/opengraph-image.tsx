import { ImageResponse } from "next/og";
import { OgCard, coatOfArms, OG_SIZE } from "@/lib/og-card";

// The site-wide share card: any bare nedb link unfurls as the institution.
export const runtime = "nodejs";
export const alt = "NEDB — Nigeria's official energy statistics";
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function Image() {
  const arms = await coatOfArms();
  return new ImageResponse(
    (
      <OgCard
        arms={arms}
        kicker="Official statistics"
        title="Nigeria's official energy statistics."
        line="Validated series, open assessments, frozen data vintages and working papers — every figure with its source and revision history."
      />
    ),
    size
  );
}
