"use client";

import { useState, useMemo } from "react";
import Link from "next/link";

interface SeriesRow {
  id: string; name: string; sector: string; subsector: string | null;
  unit_default: string; frequency: string; viz_types: string[];
  created_at: string; record_count: number;
}

interface SectorMeta { label: string; desc: string; subsectors: string }

interface Props {
  series: SeriesRow[];
  sectorMeta: Record<string, SectorMeta>;
}

function qualityScore(count: number, freq: string) {
  const expected = freq === "monthly" ? 318 : freq === "quarterly" ? 106 : 27;
  return Math.min(Math.round((count / expected) * 100), 100);
}

function QualityDots({ score }: { score: number }) {
  const filled = Math.max(0, Math.min(5, Math.ceil(score / 20)));
  const color = score >= 76 ? "#0E7A3C" : score >= 51 ? "#7CB342" : score >= 26 ? "#F9A825" : "#E04F39";
  const label = score >= 76 ? "Good" : score >= 51 ? "Moderate" : score >= 26 ? "Sparse" : score > 0 ? "Minimal" : "Empty";
  return (
    <div style={{ display: "flex", gap: 3, alignItems: "center" }}>
      {[1,2,3,4,5].map((i) => (
        <span key={i} style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: i <= filled ? color : "var(--border)" }} />
      ))}
      <span style={{ fontSize: "0.6rem", color: "var(--ink-5)", marginLeft: 3 }}>{label}</span>
    </div>
  );
}

export default function SeriesCatalogue({ series, sectorMeta }: Props) {
  const [query, setQuery]     = useState("");
  const [sector, setSector]   = useState("all");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return series.filter((s) => {
      const matchesSector = sector === "all" || s.sector === sector;
      if (!q) return matchesSector;
      return matchesSector && (
        s.name.toLowerCase().includes(q) ||
        s.sector.toLowerCase().includes(q) ||
        (s.subsector ?? "").toLowerCase().includes(q) ||
        s.unit_default.toLowerCase().includes(q) ||
        s.id.toLowerCase().includes(q)
      );
    });
  }, [series, query, sector]);

  const bySector = useMemo(() =>
    filtered.reduce((acc, s) => {
      (acc[s.sector] ??= []).push(s);
      return acc;
    }, {} as Record<string, SeriesRow[]>),
  [filtered]);

  const isSearching = query.trim() !== "" || sector !== "all";

  const sectors = Object.keys(sectorMeta).filter((s) => series.some((r) => r.sector === s));

  function SeriesCard({ s }: { s: SeriesRow }) {
    return (
      <Link href={`/series/${s.id}`} className="series-cell">
        <div className="series-meta">
          <span className="tag tag-green">{s.frequency}</span>
          {s.record_count > 0 && <span className="tag tag-muted">{s.record_count.toLocaleString()} records</span>}
        </div>
        <div className="series-name">{s.name}</div>
        <div style={{ display: "flex", gap: "1.5rem", margin: "0.625rem 0" }}>
          <div>
            <div style={{ fontSize: "1.375rem", fontFamily: "var(--font-mono)", fontWeight: 600, lineHeight: 1, color: s.record_count > 0 ? "var(--ink)" : "var(--ink-5)" }}>
              {s.record_count > 0 ? s.record_count.toLocaleString() : "—"}
            </div>
            <div style={{ fontSize: "0.65rem", color: "var(--ink-5)", textTransform: "uppercase", letterSpacing: "0.06em", marginTop: 2 }}>Records</div>
          </div>
          <div>
            <div style={{ fontSize: "0.82rem", fontWeight: 500, color: "var(--ink-3)", lineHeight: 1.5 }}>{s.unit_default}</div>
            <div style={{ fontSize: "0.65rem", color: "var(--ink-5)", textTransform: "uppercase", letterSpacing: "0.06em", marginTop: 2 }}>Unit</div>
          </div>
        </div>
        <div className="viz-chips">
          {s.viz_types.map((vt) => <span key={vt} className="viz-chip">{vt}</span>)}
        </div>
        <div style={{ marginTop: "0.5rem" }}>
          <QualityDots score={qualityScore(s.record_count, s.frequency)} />
        </div>
      </Link>
    );
  }

  return (
    <>
      {/* Search bar */}
      <div style={{ marginBottom: "1.5rem", display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ position: "relative", flex: 1, minWidth: 220 }}>
          <svg
            width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--ink-5)", pointerEvents: "none" }}
          >
            <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
          </svg>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search series by name, sector, unit…"
            style={{
              width: "100%", padding: "0.6rem 0.875rem 0.6rem 2.25rem",
              border: "1px solid var(--border)", borderRadius: "var(--r-md)",
              fontSize: "0.82rem", background: "var(--surface-white)",
              color: "var(--ink)", outline: "none", boxSizing: "border-box",
              transition: "border-color 0.15s",
            }}
            onFocus={(e) => (e.target.style.borderColor = "var(--green)")}
            onBlur={(e) => (e.target.style.borderColor = "var(--border)")}
          />
        </div>

        {/* Sector filter pills */}
        <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
          {["all", ...sectors].map((s) => (
            <button
              key={s}
              onClick={() => setSector(s)}
              style={{
                padding: "0.35rem 0.85rem", fontSize: "0.72rem", fontWeight: 600,
                borderRadius: 20, cursor: "pointer", transition: "all 0.15s",
                border: `1px solid ${sector === s ? "var(--green)" : "var(--border)"}`,
                background: sector === s ? "var(--green)" : "var(--surface-white)",
                color: sector === s ? "#fff" : "var(--ink-4)",
              }}
            >
              {s === "all" ? "All Sectors" : (sectorMeta[s]?.label ?? s)}
            </button>
          ))}
        </div>

        {isSearching && (
          <button
            onClick={() => { setQuery(""); setSector("all"); }}
            style={{ fontSize: "0.72rem", color: "var(--ink-4)", background: "none", border: "none", cursor: "pointer", textDecoration: "underline", padding: 0 }}
          >
            Clear
          </button>
        )}
      </div>

      {/* Results */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: "4rem 0", color: "var(--ink-5)" }}>
          <svg width="36" height="36" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24" style={{ opacity: 0.3, marginBottom: "0.75rem" }}>
            <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
          </svg>
          <p style={{ fontSize: "0.85rem" }}>No series match &ldquo;{query}&rdquo;{sector !== "all" ? ` in ${sectorMeta[sector]?.label ?? sector}` : ""}.</p>
          <button onClick={() => { setQuery(""); setSector("all"); }} style={{ marginTop: "0.5rem", fontSize: "0.78rem", color: "var(--green)", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>Clear search</button>
        </div>
      ) : isSearching ? (
        /* Flat results when searching */
        <>
          <div style={{ fontSize: "0.72rem", color: "var(--ink-5)", marginBottom: "1rem", letterSpacing: "0.04em" }}>
            {filtered.length} result{filtered.length !== 1 ? "s" : ""}
            {query && <> for &ldquo;<strong style={{ color: "var(--ink-3)" }}>{query}</strong>&rdquo;</>}
            {sector !== "all" && <> in <strong style={{ color: "var(--ink-3)" }}>{sectorMeta[sector]?.label ?? sector}</strong></>}
          </div>
          <div className="series-grid">
            {filtered.map((s) => <SeriesCard key={s.id} s={s} />)}
          </div>
        </>
      ) : (
        /* Grouped by sector when not searching */
        Object.entries(sectorMeta).map(([sec, meta]) => {
          const items = bySector[sec] ?? [];
          if (!items.length) return null;
          return (
            <section key={sec} id={`sector-${sec}`} style={{ marginBottom: "3rem" }}>
              <div className="sec-hd">
                <div>
                  <h2>{meta.label}</h2>
                  <p style={{ fontSize: "0.78rem", color: "var(--ink-3)", marginTop: 4, fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>{meta.desc}</p>
                  <p style={{ fontSize: "0.68rem", color: "var(--ink-5)", marginTop: 2, letterSpacing: "0.05em" }}>{meta.subsectors}</p>
                </div>
                <span className="sec-hd-meta">{items.length} series</span>
              </div>
              <div className="series-grid">
                {items.map((s) => <SeriesCard key={s.id} s={s} />)}
              </div>
            </section>
          );
        })
      )}
    </>
  );
}
