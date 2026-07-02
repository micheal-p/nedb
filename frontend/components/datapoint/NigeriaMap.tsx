"use client";

import { useEffect, useRef } from "react";

// Normalise GeoJSON shapeName → our internal state name keys
const GEO_NAME: Record<string, string> = {
  "Abuja Federal Capital Territory": "FCT (Abuja)",
};

interface NigeriaMapProps {
  stateData: Record<string, number>;
  title: string;
  unit: string;
  colorLow: string;
  colorHigh: string;
  higherIsBetter?: boolean;
  id?: string;
  source?: string;
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [parseInt(h.slice(0,2),16), parseInt(h.slice(2,4),16), parseInt(h.slice(4,6),16)];
}

function lerp(a: string, b: string, t: number): string {
  const [ar,ag,ab] = hexToRgb(a);
  const [br,bg,bb] = hexToRgb(b);
  return `rgb(${Math.round(ar+(br-ar)*t)},${Math.round(ag+(bg-ag)*t)},${Math.round(ab+(bb-ab)*t)})`;
}

export default function NigeriaMap({ stateData, title, unit, colorLow, colorHigh, higherIsBetter = false, id = "map", source }: NigeriaMapProps) {
  const mapRef    = useRef<HTMLDivElement>(null);
  const leafletRef = useRef<unknown>(null);

  const values   = Object.values(stateData).filter(v => isFinite(v));
  const hasData  = values.length > 0;
  const minV     = hasData ? Math.min(...values) : 0;
  const maxV     = hasData ? Math.max(...values) : 1;
  const sorted   = Object.entries(stateData).sort(([,a],[,b]) => b - a).slice(0, 5);

  function getColor(name: string): string {
    const v = stateData[name];
    if (v === undefined || !hasData) return "#E7E5E0";
    const t = (v - minV) / (maxV - minV || 1);
    return higherIsBetter ? lerp(colorLow, colorHigh, t) : lerp(colorHigh, colorLow, t);
  }

  function downloadCSV() {
    const rows = Object.entries(stateData).map(([s, v]) => `${s},${v}`).join("\n");
    const blob = new Blob([`State,${unit}\n${rows}`], { type: "text/csv" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = `nigeria-${id}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  useEffect(() => {
    if (!mapRef.current) return;

    let L: typeof import("leaflet");
    let map: ReturnType<typeof import("leaflet").map>;
    let destroyed = false;

    async function init() {
      // Dynamic import — leaflet is SSR-incompatible
      L = (await import("leaflet")).default;
      await import("leaflet/dist/leaflet.css");

      if (destroyed || !mapRef.current) return;

      // Remove any previous Leaflet instance on the same element
      if ((leafletRef.current as { remove?: () => void })?.remove) {
        (leafletRef.current as { remove: () => void }).remove();
      }

      map = L.map(mapRef.current, {
        zoomControl: false,
        attributionControl: false,
        dragging: false,
        scrollWheelZoom: false,
        doubleClickZoom: false,
        boxZoom: false,
        keyboard: false,
        touchZoom: false,
      });
      leafletRef.current = map;

      // Fetch the local GeoJSON
      const res  = await fetch("/nigeria-states.json");
      const geoj = await res.json();
      if (destroyed) return;

      const tooltip = L.tooltip({ sticky: true, className: "nedb-map-tooltip" });

      L.geoJSON(geoj, {
        style: (feature) => {
          const raw  = feature?.properties?.shapeName ?? "";
          const name = GEO_NAME[raw] ?? raw;
          return {
            fillColor:   getColor(name),
            fillOpacity: 1,
            color:       "#fff",
            weight:      1,
          };
        },
        onEachFeature: (feature, layer) => {
          const raw   = feature.properties?.shapeName ?? "";
          const name  = GEO_NAME[raw] ?? raw;
          const val   = stateData[name];
          const label = val !== undefined
            ? `<strong>${name}</strong><br/>${val.toLocaleString()} ${unit}`
            : `<strong>${name}</strong><br/>No data`;

          layer.bindTooltip(label, { sticky: true, className: "nedb-map-tooltip" });
          (layer as L.Path).on("mouseover", function(this: L.Path) { this.setStyle({ weight: 2, color: "#0E7A3C" }); });
          (layer as L.Path).on("mouseout",  function(this: L.Path) { this.setStyle({ weight: 1, color: "#fff" }); });
        },
      }).addTo(map);

      // Fit map to Nigeria bounds
      map.fitBounds([
        [4.2, 2.7],   // SW corner
        [13.9, 14.7], // NE corner
      ]);
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
  }, [JSON.stringify(stateData), colorLow, colorHigh, higherIsBetter, unit]);

  return (
    <div className="chart-panel" style={{ position: "relative" }}>
      <div className="chart-panel-head">
        <div>
          <div className="chart-panel-title">{title}</div>
          <div className="chart-panel-sub">Nigeria — 36 states + FCT &nbsp;·&nbsp; {unit}</div>
        </div>
        {hasData && (
          <button onClick={downloadCSV} style={{ padding: "4px 10px", fontSize: "0.7rem", fontWeight: 700, border: "1px solid var(--green-line)", borderRadius: 4, background: "var(--green-strong)", color: "var(--green-deep)", cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            CSV
          </button>
        )}
      </div>

      <div className="chart-panel-body" style={{ padding: "0.5rem", display: "grid", gridTemplateColumns: "1fr 200px", gap: "1rem", alignItems: "start" }}>
        {/* Leaflet map container */}
        <div ref={mapRef} style={{ height: 420, borderRadius: 6, overflow: "hidden", background: "#F4F2EC" }} />

        {/* Legend + top 5 */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {hasData ? (
            <>
              <div>
                <div style={{ fontSize: "0.62rem", fontWeight: 700, color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Scale</div>
                <div style={{ height: 8, borderRadius: 4, background: `linear-gradient(to right, ${higherIsBetter ? colorLow : colorHigh}, ${higherIsBetter ? colorHigh : colorLow})`, marginBottom: 4 }} />
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.65rem", color: "var(--ink-5)" }}>
                  <span>{minV.toLocaleString()}</span>
                  <span>{maxV.toLocaleString()}</span>
                </div>
              </div>
              <div>
                <div style={{ fontSize: "0.62rem", fontWeight: 700, color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Top 5 States</div>
                {sorted.map(([state, val], i) => (
                  <div key={state} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                    <div style={{ width: 16, height: 16, borderRadius: 3, background: getColor(state), flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: "0.68rem", fontWeight: 600, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{state}</div>
                      <div style={{ fontSize: "0.62rem", color: "var(--ink-4)", fontFamily: "var(--font-mono)" }}>{val.toLocaleString()} {unit}</div>
                    </div>
                    <div style={{ fontSize: "0.62rem", color: "var(--ink-5)" }}>#{i+1}</div>
                  </div>
                ))}
              </div>
              <div style={{ fontSize: "0.65rem", color: "var(--ink-5)", lineHeight: 1.5 }}>Hover over states to see values. Grey = no data available.</div>
            </>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", paddingTop: "1rem" }}>
              <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--ink-4)" }}>No state-level data</div>
              <div style={{ fontSize: "0.7rem", color: "var(--ink-5)", lineHeight: 1.5 }}>Upload records with a Nigerian state as the region to populate this map.</div>
            </div>
          )}
        </div>
      </div>

      <div className="chart-source">Source: {source ?? "NERC / NUPRC / REA / ECN"}{hasData ? "" : "  ·  Upload state-level records to populate"}</div>
    </div>
  );
}
