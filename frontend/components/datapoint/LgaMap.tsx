"use client";

// ── LgaMap.tsx ──────────────────────────────────────────────────────────────
// LGA-level choropleth: 774 Local Government Areas from the geoBoundaries ADM2
// simplified file (GRID3 source, CC BY 4.0) at /nigeria-lgas.json. Follows the
// NigeriaMap Leaflet pattern, but zoom controls are ENABLED — 774 polygons are
// unreadable without zooming.
//
// Five LGA names repeat across states (Surulere, Ifelodun, Irepodun, Bassa,
// Obi) and the boundary file carries no state attribute. In stateAware mode
// (keys "lga|state", both normLga'd) the duplicate polygons are disambiguated
// by geometry: each ambiguous polygon's centroid is point-in-polygon tested
// against /nigeria-states.json. Plain mode (keys "lga") keeps the legacy
// name-only matching for existing dashboard callers.

import { useEffect, useRef } from "react";
import { normLga } from "@/lib/geo";

interface LgaMapProps {
  lgaData: Record<string, number>;   // "lga" → value, or "lga|state" when stateAware
  title: string;
  unit: string;
  stateAware?: boolean;
  colorLow?: string;
  colorHigh?: string;
  source?: string;
  bare?: boolean;
  onSelect?: (normName: string, rawName: string, stateNorm?: string) => void;  // click an LGA polygon
  emptyTitle?: string;   // sidebar copy when no values are present
  emptyHint?: string;
}

// ── Geometry helpers for duplicate-name disambiguation ──────────────────────
type Geom = { type: string; coordinates: unknown };
function outerRings(geom: Geom): number[][][] {
  if (geom.type === "Polygon") return [(geom.coordinates as number[][][])[0]];
  if (geom.type === "MultiPolygon") return (geom.coordinates as number[][][][]).map((p) => p[0]);
  return [];
}
function pointInRing([x, y]: number[], ring: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
// A point guaranteed to lie INSIDE the polygon. The naive vertex-average can
// fall outside concave/riverine shapes (and then point-in-state tests assign
// the wrong state); when it does, fall back to the midpoint of the widest
// interior span on the ring's vertical middle — a classic label-point trick.
function interiorPoint(geom: Geom): number[] {
  const rings = outerRings(geom);
  const ring = rings.reduce((a, b) => (b.length > a.length ? b : a), rings[0] ?? []);
  if (!ring.length) return [0, 0];
  let sx = 0, sy = 0;
  for (const [x, y] of ring) { sx += x; sy += y; }
  const centroid = [sx / ring.length, sy / ring.length];
  if (pointInRing(centroid, ring)) return centroid;

  const ys = ring.map((p) => p[1]);
  const y = (Math.min(...ys) + Math.max(...ys)) / 2;
  const xs: number[] = [];
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if (yi > y !== yj > y) xs.push(xi + ((y - yi) * (xj - xi)) / (yj - yi));
  }
  xs.sort((a, b) => a - b);
  let best: number[] | null = null, bestW = -1;
  for (let i = 0; i + 1 < xs.length; i += 2) {
    const w = xs[i + 1] - xs[i];
    if (w > bestW) { bestW = w; best = [(xs[i] + xs[i + 1]) / 2, y]; }
  }
  return best ?? centroid;
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

export default function LgaMap({ lgaData, title, unit, stateAware = false, colorLow = "#C8E6C9", colorHigh = "#1B5E20", source, bare = false, onSelect, emptyTitle, emptyHint }: LgaMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletRef = useRef<unknown>(null);
  const layersRef = useRef<Map<string, unknown>>(new Map());  // data key → polygon layer, for legend click-to-zoom
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;   // stable ref so the map never re-inits on parent re-renders

  const values = Object.values(lgaData).filter((v) => isFinite(v));
  const hasData = values.length > 0;
  const minV = hasData ? Math.min(...values) : 0;
  const maxV = hasData ? Math.max(...values) : 1;
  const keyLabel = (k: string) => (stateAware ? k.replace("|", " (") + ")" : k);
  const top5 = Object.entries(lgaData).sort(([, a], [, b]) => b - a).slice(0, 5);

  function colorFor(v: number | undefined): string {
    if (v === undefined || !hasData) return "#EFEDE8";
    if (minV === maxV) return colorHigh;   // single value → strong color, not the invisible light end
    const t = (v - minV) / (maxV - minV);
    return lerp(colorLow, colorHigh, t);
  }
  function getColor(norm: string): string {
    return colorFor(lgaData[norm]);
  }

  function zoomTo(dataKey: string) {
    const layer = layersRef.current.get(dataKey) as { getBounds?: () => unknown } | undefined;
    const map = leafletRef.current as { fitBounds?: (b: unknown, opts?: object) => void } | null;
    if (layer?.getBounds && map?.fitBounds) map.fitBounds(layer.getBounds(), { maxZoom: 11, padding: [24, 24] });
  }

  function downloadCSV() {
    const rows = Object.entries(lgaData).map(([k, v]) => `${keyLabel(k)},${v}`).join("\n");
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

      // stateAware: resolve which state each duplicate-named polygon sits in
      // (centroid point-in-polygon against the state boundaries), then match
      // values keyed "lga|state". Unique names match on the lga part alone.
      type Feat = { properties?: { shapeName?: string }; geometry: Geom };
      const nameCounts = new Map<string, number>();
      for (const f of (geoj.features as Feat[])) {
        const n = normLga(f.properties?.shapeName ?? "");
        nameCounts.set(n, (nameCounts.get(n) ?? 0) + 1);
      }
      const featState = new Map<Feat, string>();          // dup feature → norm state name
      const byLgaPart = new Map<string, [string, number][]>(); // lga part → [statePart, value]
      if (stateAware) {
        for (const [k, v] of Object.entries(lgaData)) {
          const [lgaPart, statePart = ""] = k.split("|");
          if (!byLgaPart.has(lgaPart)) byLgaPart.set(lgaPart, []);
          byLgaPart.get(lgaPart)!.push([statePart, v]);
        }
        try {
          const statesGeo = await fetch("/nigeria-states.json").then((r) => r.json());
          if (destroyed) return;
          const stateFeats: { properties?: { shapeName?: string }; geometry: Geom }[] = statesGeo.features;
          for (const f of (geoj.features as Feat[])) {
            const n = normLga(f.properties?.shapeName ?? "");
            if ((nameCounts.get(n) ?? 0) < 2) continue;
            const c = interiorPoint(f.geometry);
            const hit = stateFeats.find((s) => outerRings(s.geometry).some((ring) => pointInRing(c, ring)));
            if (hit) featState.set(f, normLga(hit.properties?.shapeName ?? ""));
          }
        } catch { /* featState stays empty — valueOf falls back below */ }
      }

      const valueOf = (feature: Feat): { val: number | undefined; stateNote: string; key: string | null } => {
        const norm = normLga(feature.properties?.shapeName ?? "");
        if (!stateAware) return { val: lgaData[norm], stateNote: "", key: lgaData[norm] !== undefined ? norm : null };
        const entries = byLgaPart.get(norm) ?? [];
        const isDup = (nameCounts.get(norm) ?? 0) > 1;
        const st = featState.get(feature);
        if (isDup) {
          const match = st ? entries.find(([s]) => s === st) : undefined;
          if (match && st) return { val: match[1], stateNote: ` (${st})`, key: `${norm}|${st}` };
          // Fallback (states file unavailable or geometry unresolved): if the
          // DATA only has one state's entry for this name there is no
          // ambiguity to resolve — better a name-level match than grey.
          if (!st && entries.length === 1)
            return { val: entries[0][1], stateNote: ` (${entries[0][0]})`, key: `${norm}|${entries[0][0]}` };
          return { val: undefined, stateNote: st ? ` (${st})` : "", key: null };
        }
        return { val: entries[0]?.[1], stateNote: "", key: entries[0] ? `${norm}|${entries[0][0]}` : null };
      };

      layersRef.current = new Map();
      L.geoJSON(geoj, {
        style: (feature) => {
          const { val } = valueOf(feature as unknown as Feat);
          // In stateAware (sparse survey) mode, data polygons get a dark
          // outline so even the smallest LGAs stay visible at national zoom.
          // Plain mode keeps the legacy hairline mesh — dense databank maps
          // would drown in outlines otherwise.
          return stateAware && val !== undefined
            ? { fillColor: colorFor(val), fillOpacity: 1, color: "#0E7A3C", weight: 1.4 }
            : { fillColor: colorFor(val), fillOpacity: 1, color: "#fff", weight: 0.5 };
        },
        onEachFeature: (feature, layer) => {
          const raw = feature.properties?.shapeName ?? "";
          const norm = normLga(raw);
          const { val, stateNote, key } = valueOf(feature as unknown as Feat);
          if (key) layersRef.current.set(key, layer);
          const stNorm = stateAware
            ? featState.get(feature as unknown as Feat) ?? (key?.includes("|") ? key.split("|")[1] : undefined)
            : undefined;
          const baseColor = stateAware && val !== undefined ? "#0E7A3C" : "#fff";
          const baseWeight = stateAware && val !== undefined ? 1.4 : 0.5;
          const cap = (s: string) => s.replace(/\b\w/g, (c) => c.toUpperCase());
          const label = val !== undefined
            ? `<strong>${raw}${cap(stateNote)}</strong><br/>${val.toLocaleString()} ${unit}`
            : `<strong>${raw}${cap(stateNote)}</strong><br/>No data`;
          layer.bindTooltip(label, { sticky: true, className: "nedb-map-tooltip" });
          (layer as L.Path).on("mouseover", function (this: L.Path) { this.setStyle({ weight: 2, color: "#0E7A3C" }); });
          (layer as L.Path).on("mouseout", function (this: L.Path) { this.setStyle({ weight: baseWeight, color: baseColor }); });
          (layer as L.Path).on("click", () => { onSelectRef.current?.(norm, raw, stNorm); });
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
  }, [JSON.stringify(lgaData), colorLow, colorHigh, unit, stateAware]);

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
                {minV === maxV ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 24, height: 8, borderRadius: 4, background: colorHigh }} />
                    <span style={{ fontSize: "0.65rem", color: "var(--ink-5)" }}>{maxV.toLocaleString()} {unit} — one value so far</span>
                  </div>
                ) : (
                  <>
                    <div style={{ height: 8, borderRadius: 4, background: `linear-gradient(to right, ${colorLow}, ${colorHigh})`, marginBottom: 4 }} />
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.65rem", color: "var(--ink-5)" }}>
                      <span>{minV.toLocaleString()}</span>
                      <span>{maxV.toLocaleString()}</span>
                    </div>
                  </>
                )}
              </div>
              <div>
                <div style={{ fontSize: "0.62rem", fontWeight: 700, color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Top 5 LGAs</div>
                {top5.map(([lga, val], i) => (
                  <div key={lga} onClick={() => zoomTo(lga)} title="Click to zoom to this LGA"
                    style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6, cursor: "pointer", borderRadius: 4, padding: "2px 4px", margin: "0 -4px 6px" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "var(--green-tint)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "none")}>
                    <div style={{ width: 16, height: 16, borderRadius: 3, background: getColor(lga), flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: "0.68rem", fontWeight: 600, color: "var(--ink)", textTransform: "capitalize", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{keyLabel(lga)}</div>
                      <div style={{ fontSize: "0.62rem", color: "var(--ink-4)", fontFamily: "var(--font-mono)" }}>{val.toLocaleString()} {unit}</div>
                    </div>
                    <div style={{ fontSize: "0.62rem", color: "var(--ink-5)" }}>#{i + 1}</div>
                  </div>
                ))}
              </div>
              <div style={{ fontSize: "0.65rem", color: "var(--ink-5)", lineHeight: 1.5 }}>Click a Top-5 name to jump straight to that LGA. Hover any area for its value; grey means no data yet.</div>
            </>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", paddingTop: "1rem" }}>
              <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--ink-4)" }}>{emptyTitle ?? "No LGA-level data"}</div>
              <div style={{ fontSize: "0.7rem", color: "var(--ink-5)", lineHeight: 1.5 }}>{emptyHint ?? "Upload records tagged with a Local Government Area to populate this map."}</div>
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
