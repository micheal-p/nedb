import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import AfricaCompare, { type AfricaRow } from "@/components/charts/AfricaCompare";

// ── Nigeria in Africa — peer benchmarking ───────────────────────────────────
// Server-fetched (revalidated daily) electricity generation for Nigeria and
// peer economies, from Ember's open dataset via Our World in Data.

export const revalidate = 86400;

export const metadata = {
  title: "Nigeria in Africa — Electricity Benchmarking | NEDB",
  description: "How Nigeria's grid electricity generation compares with Ghana, Egypt, South Africa and Kenya since 2000. Official ECN data platform.",
};

const COUNTRIES = ["Nigeria", "Ghana", "Egypt", "South Africa", "Kenya"];

async function getData(): Promise<{ rows: AfricaRow[]; latest: { country: string; twh: number; year: number }[] }> {
  try {
    const res = await fetch("https://ourworldindata.org/grapher/electricity-generation.csv", {
      next: { revalidate: 86400 },
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) return { rows: [], latest: [] };
    const csv = await res.text();

    const byYear = new Map<number, AfricaRow>();
    const latestBy = new Map<string, { twh: number; year: number }>();
    for (const line of csv.split("\n")) {
      const c = line.split(",");
      const country = c[0];
      if (!COUNTRIES.includes(country)) continue;
      const year = parseInt(c[2]);
      const twh = parseFloat(c[3]);
      if (!Number.isFinite(year) || !Number.isFinite(twh) || year < 2000 || year >= new Date().getFullYear()) continue;
      if (!byYear.has(year)) byYear.set(year, { year });
      byYear.get(year)![country] = twh;
      const prev = latestBy.get(country);
      if (!prev || year > prev.year) latestBy.set(country, { twh, year });
    }
    return {
      rows: [...byYear.values()].sort((a, b) => a.year - b.year),
      latest: COUNTRIES.map((c) => ({ country: c, ...(latestBy.get(c) ?? { twh: 0, year: 0 }) })).sort((a, b) => b.twh - a.twh),
    };
  } catch {
    return { rows: [], latest: [] };
  }
}

export default async function AfricaPage() {
  const { rows, latest } = await getData();
  const ng = latest.find((l) => l.country === "Nigeria");
  const rank = latest.findIndex((l) => l.country === "Nigeria") + 1;

  return (
    <>
      <Navbar active="databank" />

      <div style={{ background: "var(--surface-white)", borderBottom: "1px solid var(--border)", padding: "1.5rem 0" }}>
        <div className="page-wrap">
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: "0.5rem" }}>
            <span className="tag tag-green">Benchmarking</span>
            <span className="tag tag-muted">Ember / OWID · updated daily</span>
          </div>
          <h1 style={{ fontFamily: "var(--font-serif)", fontSize: "1.625rem", fontWeight: 400, color: "var(--ink)", lineHeight: 1.15 }}>
            Nigeria in Africa — Electricity Generation
          </h1>
          <p style={{ fontSize: "0.82rem", color: "var(--ink-4)", marginTop: "0.4rem", maxWidth: 640, lineHeight: 1.6 }}>
            How Nigeria&apos;s grid output compares with peer African economies since 2000.
            {ng && rank > 0 && <> Nigeria currently ranks <strong>#{rank}</strong> of the five, at <strong>{ng.twh.toFixed(1)} TWh</strong> ({ng.year}).</>}
          </p>
        </div>
      </div>

      <main style={{ background: "var(--surface)", padding: "2rem 0 5rem" }}>
        <div className="page-wrap">
          {rows.length === 0 ? (
            <div className="panel" style={{ padding: "3rem", textAlign: "center", color: "var(--ink-5)" }}>
              Benchmark data temporarily unavailable — the daily refresh will restore it.
            </div>
          ) : (
            <>
              {/* Latest standings */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "1rem", marginBottom: "1.5rem" }}>
                {latest.map((l, i) => (
                  <div key={l.country} className="panel" style={{ padding: "1rem 1.25rem", borderTop: `3px solid ${l.country === "Nigeria" ? "var(--green)" : "var(--border)"}` }}>
                    <div style={{ fontSize: "0.62rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--ink-5)" }}>#{i + 1} {l.country}</div>
                    <div style={{ fontSize: "1.4rem", fontWeight: 700, fontFamily: "var(--font-mono)", color: l.country === "Nigeria" ? "var(--green)" : "var(--ink)" }}>{l.twh.toFixed(1)}</div>
                    <div style={{ fontSize: "0.68rem", color: "var(--ink-5)" }}>TWh · {l.year}</div>
                  </div>
                ))}
              </div>

              <div className="chart-panel">
                <div className="chart-panel-head">
                  <div>
                    <div className="chart-panel-title">Grid electricity generation, 2000 → present</div>
                    <div className="chart-panel-sub">TWh per year · five economies</div>
                  </div>
                </div>
                <div className="chart-panel-body">
                  <AfricaCompare data={rows} countries={COUNTRIES} />
                </div>
                <div className="chart-source">
                  Source: Ember Yearly Electricity Data via Our World in Data · refreshed daily by NEDB
                </div>
              </div>

              <div style={{ marginTop: "1.25rem", padding: "1rem 1.25rem", background: "var(--surface-white)", border: "1px solid var(--border)", borderLeft: "3px solid var(--green)", borderRadius: "var(--r-md)", fontSize: "0.8rem", color: "var(--ink-3)", lineHeight: 1.65 }}>
                <strong>How to read this:</strong> South Africa and Egypt generate several times Nigeria&apos;s grid output despite smaller populations — the benchmark that frames Nigeria&apos;s
                generation-capacity challenge. Nigeria&apos;s line excludes self-generation (diesel/petrol generators), which independent estimates put at a scale comparable to the grid itself.
              </div>
            </>
          )}
        </div>
      </main>

      <Footer />
    </>
  );
}
