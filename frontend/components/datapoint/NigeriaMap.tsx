"use client";

import { useState } from "react";
import React from "react";
import { ComposableMap, Geographies, Geography } from "react-simple-maps";

// Nigeria states GeoJSON from public CDN
const GEO_URL = "https://raw.githubusercontent.com/deldersveld/topojson/master/countries/nigeria/nigeria-states.json";

// State-level sample data per metric
const STATE_DATA: Record<string, Record<string, number>> = {
  atc_loss: {
    "Abuja Federal Capital Territory": 42.3, "Lagos": 37.5, "Rivers": 44.1,
    "Kano": 55.3, "Kaduna": 53.8, "Oyo": 51.2, "Enugu": 48.6, "Delta": 41.2,
    "Ogun": 38.4, "Anambra": 47.1, "Imo": 49.8, "Cross River": 52.4,
    "Akwa Ibom": 43.9, "Bayelsa": 45.2, "Edo": 40.7, "Ondo": 46.3,
    "Ekiti": 50.1, "Osun": 48.9, "Kwara": 49.5, "Niger": 54.2,
    "Kebbi": 57.1, "Sokoto": 58.4, "Zamfara": 61.2, "Katsina": 59.3,
    "Jigawa": 60.8, "Borno": 63.1, "Yobe": 62.4, "Gombe": 55.9,
    "Bauchi": 57.8, "Plateau": 48.2, "Nasarawa": 51.7, "Benue": 52.9,
    "Taraba": 58.6, "Adamawa": 57.2, "Kogi": 53.4, "Ebonyi": 51.8,
  },
  crude_production: {
    "Rivers": 24.2, "Delta": 18.8, "Akwa Ibom": 16.4, "Bayelsa": 14.1,
    "Imo": 5.8, "Edo": 4.2, "Ondo": 3.1, "Cross River": 2.4,
    "Lagos": 1.8, "Abia": 1.2, "Anambra": 0.8,
    "Abuja Federal Capital Territory": 0, "Kano": 0, "Kaduna": 0,
    "Oyo": 0, "Enugu": 0, "Ogun": 0, "Kebbi": 0, "Sokoto": 0,
    "Zamfara": 0, "Katsina": 0, "Jigawa": 0, "Borno": 0, "Yobe": 0,
    "Gombe": 0, "Bauchi": 0, "Plateau": 0, "Nasarawa": 0, "Benue": 0,
    "Taraba": 0, "Adamawa": 0, "Kogi": 0, "Ebonyi": 0, "Kwara": 0, "Niger": 0,
  },
  offgrid_penetration: {
    "Katsina": 78.4, "Sokoto": 82.1, "Zamfara": 84.3, "Kebbi": 76.2,
    "Jigawa": 80.9, "Yobe": 85.2, "Borno": 87.4, "Gombe": 72.1,
    "Bauchi": 74.8, "Adamawa": 73.6, "Taraba": 76.4, "Plateau": 58.3,
    "Niger": 68.4, "Kogi": 61.2, "Benue": 64.7, "Nasarawa": 59.8,
    "Kaduna": 44.2, "Kano": 41.8, "Kwara": 38.4, "Oyo": 22.1,
    "Lagos": 8.4, "Rivers": 18.2, "Delta": 21.4, "Akwa Ibom": 19.8,
    "Bayelsa": 24.1, "Enugu": 28.4, "Anambra": 24.8, "Imo": 26.1,
    "Cross River": 32.4, "Edo": 27.8, "Ondo": 29.1, "Abuja Federal Capital Territory": 12.4,
    "Ogun": 14.8, "Ekiti": 31.2, "Osun": 27.6, "Ebonyi": 38.9,
  },
  electricity_access: {
    "Lagos": 91.4, "Abuja Federal Capital Territory": 88.2, "Rivers": 74.1,
    "Ogun": 71.8, "Anambra": 68.4, "Delta": 64.2, "Edo": 62.8, "Enugu": 61.4,
    "Imo": 58.9, "Akwa Ibom": 57.2, "Cross River": 54.8, "Oyo": 63.1,
    "Ekiti": 52.4, "Osun": 54.1, "Kwara": 48.2, "Kaduna": 47.8,
    "Kano": 52.4, "Niger": 38.4, "Kogi": 42.1, "Benue": 39.8,
    "Nasarawa": 41.2, "Plateau": 44.8, "Bayelsa": 48.1, "Ondo": 56.4,
    "Abia": 54.2, "Ebonyi": 36.4, "Gombe": 38.1, "Bauchi": 34.8,
    "Adamawa": 32.4, "Taraba": 29.8, "Jigawa": 28.4, "Katsina": 27.1,
    "Sokoto": 24.8, "Kebbi": 26.2, "Zamfara": 22.4, "Yobe": 21.8, "Borno": 19.4,
  },
};

interface NigeriaMapProps {
  metric: keyof typeof STATE_DATA;
  title: string;
  unit: string;
  colorLow: string;
  colorHigh: string;
  higherIsBetter?: boolean;
}

function lerp(a: string, b: string, t: number): string {
  const hex = (s: string) => parseInt(s, 16);
  const parse = (c: string) => [hex(c.slice(1,3)), hex(c.slice(3,5)), hex(c.slice(5,7))] as [number,number,number];
  const [ar, ag, ab] = parse(a);
  const [br, bg, bb] = parse(b);
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl2 = Math.round(ab + (bb - ab) * t);
  return `rgb(${r},${g},${bl2})`;
}

export default function NigeriaMap({ metric, title, unit, colorLow, colorHigh, higherIsBetter = false }: NigeriaMapProps) {
  const [tooltip, setTooltip] = useState<{ name: string; value: number | null; x: number; y: number } | null>(null);
  const data = STATE_DATA[metric] ?? {};
  const values = Object.values(data).filter((v) => v > 0);
  const minV = Math.min(...values);
  const maxV = Math.max(...values);

  function getColor(stateName: string) {
    const v = data[stateName];
    if (v === undefined || v === 0) return "#E7E5E0";
    const t = (v - minV) / (maxV - minV || 1);
    return higherIsBetter ? lerp(colorLow, colorHigh, t) : lerp(colorHigh, colorLow, t);
  }

  function downloadCSV() {
    const rows = Object.entries(data).map(([state, val]) => `${state},${val}`).join("\n");
    const blob = new Blob([`State,${unit}\n${rows}`], { type: "text/csv" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = `nigeria-${metric}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  const sorted = Object.entries(data).sort(([,a],[,b]) => b - a).slice(0, 5);

  return (
    <div className="chart-panel" style={{ position: "relative" }}>
      <div className="chart-panel-head">
        <div>
          <div className="chart-panel-title">{title}</div>
          <div className="chart-panel-sub">Nigeria — 36 states + FCT &nbsp;·&nbsp; {unit}</div>
        </div>
        <button onClick={downloadCSV} style={{ padding: "4px 10px", fontSize: "0.7rem", fontWeight: 700, border: "1px solid var(--green-line)", borderRadius: 4, background: "var(--green-strong)", color: "var(--green-deep)", cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          CSV
        </button>
      </div>

      <div className="chart-panel-body" style={{ padding: "0.5rem", display: "grid", gridTemplateColumns: "1fr 200px", gap: "1rem", alignItems: "start" }}>
        <div style={{ position: "relative" }}
          onMouseLeave={() => setTooltip(null)}>
          <ComposableMap
            projection="geoMercator"
            projectionConfig={{ scale: 2200, center: [8.6753, 9.082] }}
            style={{ width: "100%", height: "auto" }}>
            <Geographies geography={GEO_URL}>
              {({ geographies }: { geographies: { rsmKey: string; properties: Record<string,string> }[] }) =>
                geographies.map((geo) => {
                  const name = geo.properties.NAME_1 ?? geo.properties.name ?? "";
                  return (
                    <Geography
                      key={geo.rsmKey}
                      geography={geo}
                      fill={getColor(name)}
                      stroke="#fff"
                      strokeWidth={0.5}
                      style={{ default: { outline: "none" }, hover: { outline: "none", opacity: 0.8 }, pressed: { outline: "none" } }}
                      onMouseEnter={(e: React.MouseEvent) => setTooltip({ name, value: data[name] ?? null, x: e.clientX, y: e.clientY })}
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
          {/* Legend */}
          <div>
            <div style={{ fontSize: "0.62rem", fontWeight: 700, color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Scale</div>
            <div style={{ height: 8, borderRadius: 4, background: `linear-gradient(to right, ${higherIsBetter ? colorLow : colorHigh}, ${higherIsBetter ? colorHigh : colorLow})`, marginBottom: 4 }} />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.65rem", color: "var(--ink-5)" }}>
              <span>{minV.toFixed(1)}</span>
              <span>{maxV.toFixed(1)}</span>
            </div>
          </div>

          {/* Top 5 */}
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

          <div style={{ fontSize: "0.65rem", color: "var(--ink-5)", lineHeight: 1.5 }}>
            Hover over states to see values. Grey = no data available.
          </div>
        </div>
      </div>

      <div className="chart-source">Source: NERC / NUPRC / REA / ECN &nbsp;·&nbsp; Sample data — real records populate as uploads are committed</div>
    </div>
  );
}
