// ── lib/og-card.tsx ─────────────────────────────────────────────────────────
// One share card for the whole institution. Every link forwarded through
// WhatsApp or posted anywhere unfurls as a small official document: the
// federal masthead, the coat of arms, the page's title, one line of
// substance, and the domain. Rendered by next/og (satori), which speaks a
// flexbox subset — every multi-child div must declare display:flex, and
// colours must be literal because CSS variables do not exist here.

import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const OG_SIZE = { width: 1200, height: 630 };

const INK = "#14181B";
const GREEN = "#0E7A3C";
const GREEN_BRIGHT = "#6FCF97";

export async function coatOfArms(): Promise<string | null> {
  try {
    const svg = await readFile(join(process.cwd(), "public", "coat-of-arms-ng.svg"), "utf8");
    return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
  } catch {
    return null;
  }
}

export function OgCard({
  arms, kicker, title, line, footer,
}: {
  arms: string | null;
  kicker: string;          // e.g. "NEDB WORKING PAPER · NEDB/WP/2026/01"
  title: string;
  line: string;            // one sentence of substance under the title
  footer?: string;
}) {
  return (
    <div style={{
      width: "100%", height: "100%", display: "flex", flexDirection: "column",
      background: INK, color: "#fff", fontFamily: "sans-serif",
    }}>
      {/* Federal masthead */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 14, background: GREEN, padding: "14px 40px", fontSize: 19, fontWeight: 700, letterSpacing: 2 }}>
        FEDERAL REPUBLIC OF NIGERIA · ENERGY COMMISSION OF NIGERIA
      </div>

      {/* Body */}
      <div style={{ display: "flex", flexDirection: "column", flexGrow: 1, padding: "48px 64px 40px", justifyContent: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18, marginBottom: 26 }}>
          {arms ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={arms} width={54} height={54} alt="" />
          ) : null}
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", fontSize: 26, fontWeight: 700, letterSpacing: 1 }}>NEDB</div>
            <div style={{ display: "flex", fontSize: 15, letterSpacing: 3, color: "rgba(255,255,255,0.6)" }}>NATIONAL ENERGY DATA BANK</div>
          </div>
        </div>

        <div style={{ display: "flex", fontSize: 17, fontWeight: 700, letterSpacing: 3, color: GREEN_BRIGHT, marginBottom: 14, textTransform: "uppercase" }}>
          {kicker}
        </div>
        <div style={{ display: "flex", fontSize: title.length > 70 ? 42 : 52, fontWeight: 700, lineHeight: 1.15, letterSpacing: -1, maxWidth: 1020 }}>
          {title}
        </div>
        <div style={{ display: "flex", fontSize: 22, lineHeight: 1.45, color: "rgba(255,255,255,0.72)", marginTop: 20, maxWidth: 980 }}>
          {line}
        </div>
      </div>

      {/* Foot rule */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid rgba(255,255,255,0.18)", padding: "20px 64px 26px", fontSize: 17, color: "rgba(255,255,255,0.55)" }}>
        <div style={{ display: "flex" }}>{footer ?? "Nigeria's official energy statistics"}</div>
        <div style={{ display: "flex", color: GREEN_BRIGHT, fontWeight: 700 }}>nedb.vercel.app</div>
      </div>
    </div>
  );
}
