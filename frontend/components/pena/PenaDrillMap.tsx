"use client";

// ── PenaDrillMap.tsx ────────────────────────────────────────────────────────
// Two-level PENA choropleth with NBS benchmarks:
//   Level 1 — Nigeria's 36 states + FCT colored by average survey income;
//             tooltips carry population (NBS 2022 proj.), coverage per 100k
//             and the NLSS poverty rate. Click a state to drill in.
//   Level 2 — the clicked state's LGAs (resolved by geometry: an LGA belongs
//             to the state whose polygon contains its interior point),
//             colored by average income; click an LGA to filter the table.
// GeoJSON files are fetched once per session (module-level cache).

import { useEffect, useRef } from "react";
import { normLga } from "@/lib/geo";
import { outerRings, pointInRing, interiorPoint, geomBounds, lerpColor, type Geom } from "@/lib/geo-poly";
import { coveragePer100k, NBS_POP_SOURCE, NBS_POVERTY_SOURCE, type BenchmarkIndex } from "@/lib/nbs-benchmarks";

type StateAgg = { name: string; count: number; avg_income: number | null };
type LgaAgg = { name: string; state: string | null; count: number; avg_income: number | null };
type Feat = { properties?: { shapeName?: string }; geometry: Geom };

interface PenaDrillMapProps {
  byState: StateAgg[];
  byLga: LgaAgg[];
  totalResponses: number;
  bench: BenchmarkIndex;              // admin-editable NBS figures (via /api/pena/benchmarks)
  selectedState: string | null;
  onSelectState: (state: string | null) => void;
  onSelectLga?: (lga: string, state: string) => void;
  source?: string;
}

// Fetch each boundary file once per session, not once per render
let statesGeoP: Promise<{ features: Feat[] }> | null = null;
let lgasGeoP: Promise<{ features: Feat[] }> | null = null;
const getStatesGeo = () => (statesGeoP ??= fetch("/nigeria-states.json").then((r) => r.json()));
const getLgasGeo = () => (lgasGeoP ??= fetch("/nigeria-lgas.json").then((r) => r.json()));

// Match a boundary-file state name to a data state name (handles FCT's many
// spellings: "Abuja Federal Capital Territory" vs "Federal Capital Territory").
function sameState(a: string, b: string): boolean {
  const na = normLga(a), nb = normLga(b);
  if (na === nb) return true;
  const isFct = (s: string) => s.includes("capital territory") || s === "fct" || s.includes("abuja");
  return isFct(na) && isFct(nb);
}

const COLOR_LOW = "#C8E6C9", COLOR_HIGH = "#1B5E20", NO_DATA = "#EFEDE8";
const naira = (v: number | null) => (v == null ? "—" : `₦${Math.round(v).toLocaleString()}`);
const compact = (n: number) => (n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}m` : `${Math.round(n / 1000)}k`);

export default function PenaDrillMap({ byState, byLga, totalResponses, bench, selectedState, onSelectState, onSelectLga, source }: PenaDrillMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletRef = useRef<unknown>(null);
  const cbRef = useRef({ onSelectState, onSelectLga });
  cbRef.current = { onSelectState, onSelectLga };

  const stateOf = (name: string) => byState.find((s) => sameState(s.name, name));
  const selAgg = selectedState ? stateOf(selectedState) : undefined;
  const selBench = selectedState ? bench.state(selectedState) : null;
  const selLgas = selectedState ? byLga.filter((l) => l.state && sameState(l.state, selectedState)) : [];

  useEffect(() => {
    if (!mapRef.current) return;
    let destroyed = false;

    async function init() {
      const L = (await import("leaflet")).default;
      await import("leaflet/dist/leaflet.css");
      if (destroyed || !mapRef.current) return;

      if ((leafletRef.current as { remove?: () => void })?.remove) {
        (leafletRef.current as { remove: () => void }).remove();
      }
      const map = L.map(mapRef.current, {
        zoomControl: true, attributionControl: false, scrollWheelZoom: false,
        dragging: true, doubleClickZoom: true,
      });
      leafletRef.current = map;
      map.getContainer().style.touchAction = "pan-y";

      const statesGeo = await getStatesGeo();
      if (destroyed) return;

      if (!selectedState) {
        // ── Level 1: states choropleth ────────────────────────────────────
        const vals = byState.map((s) => s.avg_income).filter((v): v is number => v != null);
        const minV = vals.length ? Math.min(...vals) : 0;
        const maxV = vals.length ? Math.max(...vals) : 1;
        const colorFor = (v: number | null | undefined) =>
          v == null ? NO_DATA : minV === maxV ? COLOR_HIGH : lerpColor(COLOR_LOW, COLOR_HIGH, (v - minV) / (maxV - minV));

        L.geoJSON(statesGeo as never, {
          style: (f) => {
            const agg = stateOf((f as Feat).properties?.shapeName ?? "");
            return { fillColor: colorFor(agg?.avg_income), fillOpacity: 1, color: agg ? "#0E7A3C" : "#fff", weight: agg ? 1.2 : 0.7 };
          },
          onEachFeature: (f, layer) => {
            const raw = (f as Feat).properties?.shapeName ?? "";
            const agg = stateOf(raw);
            const sb = bench.state(agg?.name ?? raw);
            const cov = sb?.population && agg ? coveragePer100k(agg.count, sb.population) : null;
            const lines = [
              `<strong>${raw}</strong>`,
              agg ? `${naira(agg.avg_income)}/month avg · ${agg.count} response${agg.count === 1 ? "" : "s"}` : "No responses yet",
              sb?.population ? `Population ${compact(sb.population)} (NBS)${cov != null ? ` · coverage ${cov.toFixed(2)}/100k` : ""}` : "",
              sb?.poverty_rate != null ? `NBS poverty rate ${sb.poverty_rate}%` : "",
              `<em>Click to open its LGAs</em>`,
            ].filter(Boolean);
            layer.bindTooltip(lines.join("<br/>"), { sticky: true, className: "nedb-map-tooltip" });
            (layer as L.Path).on("mouseover", function (this: L.Path) { this.setStyle({ weight: 2, color: "#0E7A3C" }); });
            (layer as L.Path).on("mouseout", function (this: L.Path) { this.setStyle({ weight: agg ? 1.2 : 0.7, color: agg ? "#0E7A3C" : "#fff" }); });
            (layer as L.Path).on("click", () => cbRef.current.onSelectState(agg?.name ?? raw));
          },
        }).addTo(map);
        map.fitBounds([[4.2, 2.7], [13.9, 14.7]]);
      } else {
        // ── Level 2: the selected state's LGAs ────────────────────────────
        const stateFeat = (statesGeo.features as Feat[]).find((f) => sameState(f.properties?.shapeName ?? "", selectedState));

        // Pale national backdrop for context
        L.geoJSON(statesGeo as never, {
          style: { fillColor: "#F1EFE9", fillOpacity: 1, color: "#fff", weight: 0.7 },
          interactive: false,
        }).addTo(map);

        const lgasGeo = await getLgasGeo();
        if (destroyed) return;

        const inState = stateFeat
          ? (lgasGeo.features as Feat[]).filter((f) => {
              const p = interiorPoint(f.geometry);
              return outerRings(stateFeat.geometry).some((ring) => pointInRing(p, ring));
            })
          : [];

        const lgaAggOf = (name: string) => selLgas.find((l) => normLga(l.name) === normLga(name));
        const vals = selLgas.map((l) => l.avg_income).filter((v): v is number => v != null);
        const minV = vals.length ? Math.min(...vals) : 0;
        const maxV = vals.length ? Math.max(...vals) : 1;
        const colorFor = (v: number | null | undefined) =>
          v == null ? NO_DATA : minV === maxV ? COLOR_HIGH : lerpColor(COLOR_LOW, COLOR_HIGH, (v - minV) / (maxV - minV));

        L.geoJSON({ type: "FeatureCollection", features: inState } as never, {
          style: (f) => {
            const agg = lgaAggOf((f as Feat).properties?.shapeName ?? "");
            return { fillColor: colorFor(agg?.avg_income), fillOpacity: 1, color: agg ? "#0E7A3C" : "#fff", weight: agg ? 1.4 : 0.6 };
          },
          onEachFeature: (f, layer) => {
            const raw = (f as Feat).properties?.shapeName ?? "";
            const agg = lgaAggOf(raw);
            const pop = bench.lga(raw, selectedState);
            const cov = pop && agg ? coveragePer100k(agg.count, pop) : null;
            const lines = [
              `<strong>${raw}</strong> (${selectedState})`,
              agg ? `${naira(agg.avg_income)}/month avg · ${agg.count} response${agg.count === 1 ? "" : "s"}` : "No responses yet",
              pop ? `Population ${compact(pop)} (NBS)${cov != null ? ` · coverage ${cov.toFixed(2)}/100k` : ""}` : "",
            ].filter(Boolean);
            layer.bindTooltip(lines.join("<br/>"), { sticky: true, className: "nedb-map-tooltip" });
            (layer as L.Path).on("mouseover", function (this: L.Path) { this.setStyle({ weight: 2, color: "#0E7A3C" }); });
            (layer as L.Path).on("mouseout", function (this: L.Path) { this.setStyle({ weight: agg ? 1.4 : 0.6, color: agg ? "#0E7A3C" : "#fff" }); });
            if (agg) (layer as L.Path).on("click", () => cbRef.current.onSelectLga?.(agg.name, selectedState!));
          },
        }).addTo(map);

        if (stateFeat) map.fitBounds(geomBounds(stateFeat.geometry), { padding: [16, 16] });
        else map.fitBounds([[4.2, 2.7], [13.9, 14.7]]);
      }
    }

    init();
    return () => {
      destroyed = true;
      if ((leafletRef.current as { remove?: () => void })?.remove) {
        (leafletRef.current as { remove: () => void }).remove();
        leafletRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedState, JSON.stringify(byState), JSON.stringify(byLga), bench]);

  const natCov = coveragePer100k(totalResponses, bench.national);
  const topStates = [...byState].sort((a, b) => (b.avg_income ?? -1) - (a.avg_income ?? -1)).slice(0, 5);

  return (
    <div className="chart-panel" style={{ position: "relative" }}>
      <div className="chart-panel-head">
        <div>
          <div className="chart-panel-title">
            {selectedState ? (
              <>Average Monthly Income — {selectedState} by LGA</>
            ) : (
              <>Average Monthly Income by State — click a state to open its LGAs</>
            )}
          </div>
          <div className="chart-panel-sub">
            {selectedState
              ? `${selLgas.reduce((a, l) => a + l.count, 0)} responses across ${selLgas.length} LGA${selLgas.length === 1 ? "" : "s"} · click an LGA to filter the table`
              : `Nigeria — 36 states + FCT · benchmarked against NBS population & poverty figures`}
          </div>
        </div>
        {selectedState && (
          <button onClick={() => onSelectState(null)}
            style={{ padding: "5px 14px", fontSize: "0.74rem", fontWeight: 700, border: "1px solid var(--green-line)", borderRadius: 4, background: "var(--green-tint)", color: "var(--green)", cursor: "pointer", whiteSpace: "nowrap" }}>
            ← All States
          </button>
        )}
      </div>

      <div className="chart-panel-body nigeria-map-body">
        <div ref={mapRef} className="nigeria-map-canvas" style={{ minHeight: 440 }} />
        <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
          {selectedState ? (
            <>
              <div>
                <div style={{ fontSize: "0.62rem", fontWeight: 700, color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>{selectedState} vs NBS</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div>
                    <div style={{ fontSize: "0.95rem", fontWeight: 700, fontFamily: "var(--font-mono)", color: "var(--ink)" }}>{selAgg?.count ?? 0}</div>
                    <div style={{ fontSize: "0.65rem", color: "var(--ink-5)" }}>responses collected</div>
                  </div>
                  <div>
                    <div style={{ fontSize: "0.95rem", fontWeight: 700, fontFamily: "var(--font-mono)", color: "var(--ink)" }}>{selBench?.population ? compact(selBench.population) : "—"}</div>
                    <div style={{ fontSize: "0.65rem", color: "var(--ink-5)" }}>population (NBS)</div>
                  </div>
                  <div>
                    <div style={{ fontSize: "0.95rem", fontWeight: 700, fontFamily: "var(--font-mono)", color: "var(--green)" }}>
                      {selBench?.population && selAgg ? `${(coveragePer100k(selAgg.count, selBench.population) ?? 0).toFixed(2)}` : "—"}
                    </div>
                    <div style={{ fontSize: "0.65rem", color: "var(--ink-5)" }}>responses per 100,000 residents</div>
                  </div>
                  <div>
                    <div style={{ fontSize: "0.95rem", fontWeight: 700, fontFamily: "var(--font-mono)", color: "var(--ink)" }}>{selBench?.poverty_rate != null ? `${selBench.poverty_rate}%` : "—"}</div>
                    <div style={{ fontSize: "0.65rem", color: "var(--ink-5)" }}>NBS poverty rate</div>
                  </div>
                  <div>
                    <div style={{ fontSize: "0.95rem", fontWeight: 700, fontFamily: "var(--font-mono)", color: "var(--ink)" }}>{naira(selAgg?.avg_income ?? null)}</div>
                    <div style={{ fontSize: "0.65rem", color: "var(--ink-5)" }}>PENA average monthly income</div>
                  </div>
                </div>
              </div>
              <div style={{ fontSize: "0.65rem", color: "var(--ink-5)", lineHeight: 1.5 }}>
                Low coverage means the sample is still thin here — treat averages as indicative until more responses arrive.
              </div>
            </>
          ) : (
            <>
              <div>
                <div style={{ fontSize: "0.62rem", fontWeight: 700, color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>National Coverage</div>
                <div style={{ fontSize: "0.95rem", fontWeight: 700, fontFamily: "var(--font-mono)", color: "var(--green)" }}>
                  {natCov == null ? "—" : natCov < 0.01 && totalResponses > 0 ? "<0.01" : natCov.toFixed(2)}
                </div>
                <div style={{ fontSize: "0.65rem", color: "var(--ink-5)" }}>responses per 100,000 residents{bench.national ? ` (${compact(bench.national)} pop.)` : ""}</div>
              </div>
              {topStates.some((s) => s.avg_income != null) && (
                <div>
                  <div style={{ fontSize: "0.62rem", fontWeight: 700, color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Top States by Avg Income</div>
                  {topStates.filter((s) => s.avg_income != null).map((s, i) => (
                    <div key={s.name} onClick={() => onSelectState(s.name)} title="Click to open this state"
                      style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6, cursor: "pointer", borderRadius: 4, padding: "2px 4px", margin: "0 -4px 6px" }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "var(--green-tint)")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "none")}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: "0.68rem", fontWeight: 600, color: "var(--ink)" }}>{s.name}</div>
                        <div style={{ fontSize: "0.62rem", color: "var(--ink-4)", fontFamily: "var(--font-mono)" }}>{naira(s.avg_income)} · {s.count} resp.</div>
                      </div>
                      <div style={{ fontSize: "0.62rem", color: "var(--ink-5)" }}>#{i + 1}</div>
                    </div>
                  ))}
                </div>
              )}
              <div style={{ fontSize: "0.65rem", color: "var(--ink-5)", lineHeight: 1.5 }}>
                Hover a state for its population, coverage and poverty benchmark. Click it (or a Top-State entry) to open its LGAs. Grey = no data yet.
              </div>
            </>
          )}
        </div>
      </div>

      <div className="chart-source">
        Data source: {source ?? "PENA field assessment / NEDB"} &nbsp;·&nbsp; {NBS_POP_SOURCE} &nbsp;·&nbsp; {NBS_POVERTY_SOURCE}
      </div>
    </div>
  );
}
