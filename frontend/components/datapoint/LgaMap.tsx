"use client";

// ── LgaMap.tsx ──────────────────────────────────────────────────────────────
// LGA-level choropleth: 774 Local Government Areas from the geoBoundaries ADM2
// simplified file (GRID3 source, CC BY 4.0) at /nigeria-lgas.json. Follows the
// NigeriaMap Leaflet pattern, but zoom controls are ENABLED — 774 polygons are
// unreadable without zooming. Values are keyed by normalized LGA name; a handful
// of LGA names repeat across states (Obi, Surulere, Bassa…) — those share a
// colour, a known v1 limitation of the boundary file (it carries no state attr).

import { useEffect, useRef } from "react";
import { normLga } from "@/lib/geo";

interface LgaMapProps {
  lgaData: Record<string, number>;   // normalized-lga-name → value
  title: string;
  unit: string;
  colorLow?: string;
  colorHigh?: string;
  source?: string;
  bare?: boolean;
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
function lerp(a: string, b: string, t: number): string {
  const [ar, ag, ab] = hexToRgb(a);
  const [br, bg, bb] = hexToRgb(b);
  return `rgb(${Math.round(ar + (br - ar) * t)},${Math.round(ag + (bg - ag) * t)},${Math.round(ab + (bb - ab) * t)})`;
}

export default function LgaMap({ lgaData, title, unit, colorLow = "#C8E6C9", colorHigh = "#1B5E20", source, bare = false }: LgaMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletRef = useRef<unknown>(null);

  const values = Object.values(lgaData).filter((v) => isFinite(v));
  const hasData = values.length > 0;
  const minV = hasData ? Math.min(...values) : 0;
  const maxV = hasData ? Math.max(...values) : 1;
  const top5 = Object.entries(lgaData).sort(([, a], [, b]) => b - a).slice(0, 5);

  function getColor(norm: string): string {
    const v = lgaData[norm];
    if (v === undefined || !hasData) return "#EFEDE8";
    const t = (v - minV) / (maxV - minV || 1);
    return lerp(colorLow, colorHigh, t);
  }

  function downloadCSV() {
    const rows = Object.entries(lgaData).map(([k, v]) => `${k},${v}`).join("\n");
    const blob = new Blob([`LGA,${unit}\n${rows}`], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "nigeria-lga-data.csv"; a.click();
    URL.revokeObjectURL(url);
  }

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
        zoomControl: true,           // zoom is essential at LGA granularity
        attributionControl: false,
        scrollWheelZoom: false,      // keep page scroll usable
        dragging: true,
        doubleClickZoom: true,
      });
      leafletRef.current = map;
      map.getContainer().style.touchAction = "pan-y";

      const res = await fetch("/nigeria-lgas.json");
      const geoj = await res.json();
      if (destroyed) return;

      L.geoJSON(geoj, {
        style: (feature) => {
          const norm = normLga(feature?.properties?.shapeName ?? "");
          return { fillColor: getColor(norm), fillOpacity: 1, color: "#fff", weight: 0.5 };
        },
        onEachFeature: (feature, layer) => {
          const raw = feature.properties?.shapeName ?? "";
          const norm = normLga(raw);
          const val = lgaData[norm];
          const label = val !== undefined
            ? `<strong>${raw}</strong><br/>${val.toLocaleString()} ${unit}`
            : `<strong>${raw}</strong><br/>No data`;
          layer.bindTooltip(label, { sticky: true, className: "nedb-map-tooltip" });
          (layer as L.Path).on("mouseover", function (this: L.Path) { this.setStyle({ weight: 1.5, color: "#0E7A3C" }); });
          (layer as L.Path).on("mouseout", function (this: L.Path) { this.setStyle({ weight: 0.5, color: "#fff" }); });
        },
      }).addTo(map);

      map.fitBounds([[4.2, 2.7], [13.9, 14.7]]);
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
  }, [JSON.stringify(lgaData), colorLow, colorHigh, unit]);

  const inner = (
    <>
      <div className="chart-panel-head">
        <div>
          <div className="chart-panel-title">{title}</div>
          <div className="chart-panel-sub">Nigeria — 774 Local Government Areas &nbsp;·&nbsp; {unit}</div>
        </div>
        {hasData && (
          <button onClick={downloadCSV} style={{ padding: "4px 10px", fontSize: "0.7rem", fontWeight: 700, border: "1px solid var(--green-line)", borderRadius: 4, background: "var(--green-strong)", color: "var(--green-deep)", cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            CSV
          </button>
        )}
      </div>

      <div className="chart-panel-body nigeria-map-body">
        <div ref={mapRef} className="nigeria-map-canvas" style={{ minHeight: 420 }} />
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {hasData ? (
            <>
              <div>
                <div style={{ fontSize: "0.62rem", fontWeight: 700, color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Scale</div>
                <div style={{ height: 8, borderRadius: 4, background: `linear-gradient(to right, ${colorLow}, ${colorHigh})`, marginBottom: 4 }} />
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.65rem", color: "var(--ink-5)" }}>
                  <span>{minV.toLocaleString()}</span>
                  <span>{maxV.toLocaleString()}</span>
                </div>
              </div>
              <div>
                <div style={{ fontSize: "0.62rem", fontWeight: 700, color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Top 5 LGAs</div>
                {top5.map(([lga, val], i) => (
                  <div key={lga} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                    <div style={{ width: 16, height: 16, borderRadius: 3, background: getColor(lga), flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: "0.68rem", fontWeight: 600, color: "var(--ink)", textTransform: "capitalize", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{lga}</div>
                      <div style={{ fontSize: "0.62rem", color: "var(--ink-4)", fontFamily: "var(--font-mono)" }}>{val.toLocaleString()} {unit}</div>
                    </div>
                    <div style={{ fontSize: "0.62rem", color: "var(--ink-5)" }}>#{i + 1}</div>
                  </div>
                ))}
              </div>
              <div style={{ fontSize: "0.65rem", color: "var(--ink-5)", lineHeight: 1.5 }}>Use + / − to zoom. Hover an LGA for its value. Grey = no data.</div>
            </>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", paddingTop: "1rem" }}>
              <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--ink-4)" }}>No LGA-level data</div>
              <div style={{ fontSize: "0.7rem", color: "var(--ink-5)", lineHeight: 1.5 }}>Upload records tagged with a Local Government Area to populate this map.</div>
            </div>
          )}
        </div>
      </div>

      <div className="chart-source">
        Data source: {source ?? "ECN / NEDB"} &nbsp;·&nbsp; Boundaries: GRID3 / geoBoundaries (CC BY 4.0)
      </div>
    </>
  );

  return bare ? inner : <div className="chart-panel" style={{ position: "relative" }}>{inner}</div>;
}
