"use client";

// ── PenaPointsMap.tsx ───────────────────────────────────────────────────────
// Plots individual PENA responses as circle markers on an OSM basemap, colored
// by environmental-economic tier. Follows the LgaMap Leaflet pattern (dynamic
// import, no SSR). Tiles are OpenStreetMap — attribution control stays ON,
// required by the OSM licence. Tier identity is never color-alone: the legend
// and every tooltip carry the tier letter + name.

import { useEffect, useRef } from "react";
import { TIERS, TIER_ORDER, type PenaTier } from "@/lib/pena";

export type PenaPoint = { lat: number; lng: number; tier: string | null; income: number | null; lga: string | null };

interface PenaPointsMapProps {
  points: PenaPoint[];
  title: string;
  source?: string;
  bare?: boolean;
}

export default function PenaPointsMap({ points, title, source, bare = false }: PenaPointsMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletRef = useRef<unknown>(null);

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
        zoomControl: true,
        attributionControl: true,     // OSM tiles require visible attribution
        scrollWheelZoom: false,
        dragging: true,
        doubleClickZoom: true,
      });
      leafletRef.current = map;
      map.getContainer().style.touchAction = "pan-y";

      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 18,
      }).addTo(map);

      const valid = points.filter((p) => isFinite(p.lat) && isFinite(p.lng));
      for (const p of valid) {
        const t = (p.tier ?? null) as PenaTier | null;
        const color = t ? TIERS[t].color : "#8B857A";
        const label = t ? `Tier ${t} — ${TIERS[t].label}` : "Unclassified";
        L.circleMarker([p.lat, p.lng], {
          radius: 6,
          fillColor: color,
          fillOpacity: 0.85,
          color: "#fff",              // 2px surface ring so overlapping marks stay separable
          weight: 2,
        })
          .bindTooltip(
            `<strong>${label}</strong><br/>${p.lga ?? "Unknown LGA"}${p.income != null ? `<br/>₦${p.income.toLocaleString()}/month` : ""}`,
            { sticky: true, className: "nedb-map-tooltip" }
          )
          .addTo(map);
      }

      if (valid.length) {
        map.fitBounds(L.latLngBounds(valid.map((p) => [p.lat, p.lng] as [number, number])).pad(0.15));
      } else {
        map.fitBounds([[4.2, 2.7], [13.9, 14.7]]);
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
  }, [JSON.stringify(points)]);

  const counts = TIER_ORDER.map((t) => ({ t, n: points.filter((p) => p.tier === t).length }));

  const inner = (
    <>
      <div className="chart-panel-head">
        <div>
          <div className="chart-panel-title">{title}</div>
          <div className="chart-panel-sub">{points.length.toLocaleString()} geocoded responses &nbsp;·&nbsp; colored by tier</div>
        </div>
      </div>

      <div className="chart-panel-body">
        <div ref={mapRef} className="nigeria-map-canvas" style={{ minHeight: 440 }} />
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.875rem", marginTop: "0.75rem" }}>
          {counts.map(({ t, n }) => (
            <div key={t} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 12, height: 12, borderRadius: "50%", background: TIERS[t].color, border: "2px solid #fff", boxShadow: "0 0 0 1px var(--border)", flexShrink: 0 }} />
              <span style={{ fontSize: "0.7rem", color: "var(--ink-3)" }}>
                <strong>Tier {t}</strong> {TIERS[t].label} <span style={{ color: "var(--ink-5)", fontFamily: "var(--font-mono)" }}>({n})</span>
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="chart-source">
        Data source: {source ?? "PENA field assessment / NEDB"} &nbsp;·&nbsp; Basemap: © OpenStreetMap contributors
      </div>
    </>
  );

  return bare ? inner : <div className="chart-panel" style={{ position: "relative" }}>{inner}</div>;
}
