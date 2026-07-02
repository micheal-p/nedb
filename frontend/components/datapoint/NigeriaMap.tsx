"use client";

import { useState } from "react";
import React from "react";
import { ComposableMap, Geographies, Geography } from "react-simple-maps";

const GEO_URL = "/nigeria-states.json";

// Normalise GeoJSON shapeName → our internal state name (zone/upload dropdown keys)
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

function lerp(a: string, b: string, t: number): string {
  const hex = (s: string) => parseInt(s, 16);
  const parse = (c: string) => [hex(c.slice(1,3)), hex(c.slice(3,5)), hex(c.slice(5,7))] as [number,number,number];
  const [ar, ag, ab] = parse(a);
  const [br, bg, bb] = parse(b);
  const r   = Math.round(ar + (br - ar) * t);
  const g   = Math.round(ag + (bg - ag) * t);
  const bl2 = Math.round(ab + (bb - ab) * t);
  return `rgb(${r},${g},${bl2})`;
}

export default function NigeriaMap({ stateData, title, unit, colorLow, colorHigh, higherIsBetter = false, id = "map", source }: NigeriaMapProps) {
  const [tooltip, setTooltip] = useState<{ name: string; value: number | null; x: number; y: number } | null>(null);

  const values  = Object.values(stateData).filter((v) => v > 0);
  const hasData = values.length > 0;
  const minV    = hasData ? Math.min(...values) : 0;
  const maxV    = hasData ? Math.max(...values) : 100;

  function getColor(stateName: string) {
    const v = stateData[stateName];
    if (v === undefined || v === 0 || !hasData) return "#E7E5E0";
    const t = (v - minV) / (maxV - minV || 1);
    return higherIsBetter ? lerp(colorLow, colorHigh, t) : lerp(colorHigh, colorLow, t);
  }

  function downloadCSV() {
    if (!hasData) return;
    const rows = Object.entries(stateData).map(([state, val]) => `${state},${val}`).join("\n");
    const blob = new Blob([`State,${unit}\n${rows}`], { type: "text/csv" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = `nigeria-${id}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  const sorted = Object.entries(stateData).sort(([,a],[,b]) => b - a).slice(0, 5);

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
        <div style={{ position: "relative" }} onMouseLeave={() => setTooltip(null)}>
          <ComposableMap
            projection="geoMercator"
            projectionConfig={{ scale: 2200, center: [8.6753, 9.082] }}
            style={{ width: "100%", height: "auto" }}>
            <Geographies geography={GEO_URL}>
              {({ geographies }: { geographies: { rsmKey: string; properties: Record<string,string> }[] }) =>
                geographies.map((geo) => {
                  const rawName = geo.properties.shapeName ?? geo.properties.NAME_1 ?? geo.properties.name ?? "";
                  const name = GEO_NAME[rawName] ?? rawName;
                  return (
                    <Geography
                      key={geo.rsmKey}
                      geography={geo}
                      fill={getColor(name)}
                      stroke="#fff"
                      strokeWidth={0.5}
                      style={{ default: { outline: "none" }, hover: { outline: "none", opacity: 0.8 }, pressed: { outline: "none" } }}
                      onMouseEnter={(e: React.MouseEvent) => setTooltip({ name: rawName === name ? name : `${name} (${rawName})`, value: stateData[name] ?? null, x: e.clientX, y: e.clientY })}
                    />
                  );
                })
              }
            </Geographies>
          </ComposableMap>

          {tooltip && (
            <div style={{ position: "fixed", left: tooltip.x + 12, top: tooltip.y - 8, background: "#fff", border: "1px solid var(--border)", borderRadius: 6, padding: "6px 10px", fontSize: "0.75rem", boxShadow: "var(--shadow-2)", pointerEvents: "none", zIndex: 1000 }}>
              <div style={{ fontWeight: 700, color: "var(--ink)" }}>{tooltip.name}</div>
              <div style={{ color: "var(--ink-4)" }}>{tooltip.value !== null ? `${tooltip.value.toFixed(1)} ${unit}` : "No data"}</div>
            </div>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {hasData ? (
            <>
              <div>
                <div style={{ fontSize: "0.62rem", fontWeight: 700, color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Scale</div>
                <div style={{ height: 8, borderRadius: 4, background: `linear-gradient(to right, ${higherIsBetter ? colorLow : colorHigh}, ${higherIsBetter ? colorHigh : colorLow})`, marginBottom: 4 }} />
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.65rem", color: "var(--ink-5)" }}>
                  <span>{minV.toFixed(1)}</span>
                  <span>{maxV.toFixed(1)}</span>
                </div>
              </div>
              <div>
                <div style={{ fontSize: "0.62rem", fontWeight: 700, color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Top 5 States</div>
                {sorted.map(([state, val], i) => (
                  <div key={state} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                    <div style={{ width: 16, height: 16, borderRadius: 3, background: getColor(state), flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: "0.68rem", fontWeight: 600, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{state.replace(" Federal Capital Territory", " (FCT)").replace(" State", "")}</div>
                      <div style={{ fontSize: "0.62rem", color: "var(--ink-4)", fontFamily: "var(--font-mono)" }}>{val.toFixed(1)} {unit}</div>
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
              <div style={{ fontSize: "0.65rem", color: "var(--ink-5)", marginTop: 4 }}>All states shown in grey until data is committed.</div>
            </div>
          )}
        </div>
      </div>

      <div className="chart-source">Source: {source ?? "NERC / NUPRC / REA / ECN"}{hasData ? "" : "  ·  No data — upload state-level records via Admin → Data Entry"}</div>
    </div>
  );
}
