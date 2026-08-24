"use client";

// ── /terminal/coverage — What is missing ────────────────────────────────────
// A statistics office is judged on its gaps as much as its figures. This is the
// honest inventory: which series are current, which are behind, which have
// holes in the middle, and which were registered and never filled.

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { getTokenFresh } from "@/lib/auth";
import { SECTOR_LABEL } from "@/lib/bulletin-shared";

type Coverage = {
  id: string; name: string; sector: string; frequency: string; is_public: boolean;
  record_count: number; latest_period: string | null; periods_behind: number | null; gaps: string[];
};

type Health = "empty" | "stale" | "holes" | "current";

function healthOf(c: Coverage): Health {
  if (c.record_count === 0) return "empty";
  if ((c.periods_behind ?? 0) >= 2) return "stale";
  if (c.gaps.length > 0) return "holes";
  return "current";
}

const HEALTH = {
  empty:   { label: "No data",  color: "var(--red)",   note: "Registered but never filled" },
  stale:   { label: "Behind",   color: "var(--amber)", note: "Two or more periods out of date" },
  holes:   { label: "Has gaps", color: "var(--amber)", note: "Missing periods inside its range" },
  current: { label: "Current",  color: "var(--green)", note: "Up to date and complete" },
} as const;

export default function CoveragePage() {
  const [rows, setRows] = useState<Coverage[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Health | "all">("all");

  useEffect(() => {
    (async () => {
      const token = await getTokenFresh();
      const r = await fetch("/api/terminal/pipeline", {
        credentials: "include",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      }).catch(() => null);
      if (r?.ok) { const j = await r.json(); setRows(j.coverage ?? []); }
      setLoading(false);
    })();
  }, []);

  const counts = useMemo(() => {
    const c: Record<Health, number> = { empty: 0, stale: 0, holes: 0, current: 0 };
    for (const r of rows) c[healthOf(r)]++;
    return c;
  }, [rows]);

  const shown = useMemo(() => {
    const list = filter === "all" ? rows : rows.filter((r) => healthOf(r) === filter);
    const order: Health[] = ["empty", "stale", "holes", "current"];
    return [...list].sort((a, b) => order.indexOf(healthOf(a)) - order.indexOf(healthOf(b)) || a.name.localeCompare(b.name));
  }, [rows, filter]);

  const completeness = rows.length ? (counts.current / rows.length) * 100 : 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.1rem" }}>

      <div className="grid-4 grid-hair">
        {(["current", "holes", "stale", "empty"] as Health[]).map((h) => (
          <button key={h} onClick={() => setFilter(filter === h ? "all" : h)}
            className="stat-cell" style={{ textAlign: "left", cursor: "pointer", border: "none", borderTop: `2px solid ${filter === h ? HEALTH[h].color : "transparent"}` }}>
            <div className="val" style={{ color: counts[h] ? HEALTH[h].color : "var(--ink-5)" }}>{counts[h]}</div>
            <div className="lbl">{HEALTH[h].label}</div>
            <div className="sub">{HEALTH[h].note}</div>
          </button>
        ))}
      </div>

      <div className="term-card">
        <div className="term-card-head">
          <span className="term-card-title">
            Series coverage{filter !== "all" ? ` — ${HEALTH[filter as Health].label}` : ""}
          </span>
          <span className="term-card-meta">
            {completeness.toFixed(0)}% of registered series are current and complete
            {filter !== "all" && <> · <button onClick={() => setFilter("all")} style={{ background: "none", border: "none", color: "var(--green)", fontWeight: 700, cursor: "pointer", fontSize: "var(--t-xs)" }}>show all</button></>}
          </span>
        </div>

        {loading ? (
          <div style={{ padding: "1rem", fontSize: "var(--t-sm)", color: "var(--ink-5)" }}>Loading…</div>
        ) : shown.length === 0 ? (
          <div style={{ padding: "1.1rem", fontSize: "var(--t-base)", color: "var(--ink-4)" }}>Nothing in this category.</div>
        ) : (
          <div className="scroll-x">
            <table className="data-table" style={{ fontSize: "var(--t-sm)" }}>
              <thead>
                <tr>
                  <th>Series</th><th>Sector</th><th>Frequency</th>
                  <th>Latest</th>
                  <th style={{ textAlign: "right" }}>Records</th>
                  <th style={{ textAlign: "right" }}>Behind</th>
                  <th>Missing periods</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {shown.map((c) => {
                  const h = healthOf(c);
                  return (
                    <tr key={c.id}>
                      <td className="td-primary">
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
                          <span style={{ width: 7, height: 7, background: HEALTH[h].color, flexShrink: 0 }} />
                          {c.name}
                        </span>
                        {!c.is_public && <span className="tag tag-muted" style={{ marginLeft: 14, fontSize: "0.55rem" }}>WITHHELD FROM API</span>}
                      </td>
                      <td style={{ color: "var(--ink-4)" }}>{SECTOR_LABEL[c.sector] ?? c.sector}</td>
                      <td style={{ color: "var(--ink-4)", textTransform: "capitalize" }}>{c.frequency}</td>
                      <td style={{ fontVariantNumeric: "tabular-nums", color: c.latest_period ? "var(--ink-3)" : "var(--red)" }}>
                        {c.latest_period ?? "never"}
                      </td>
                      <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{c.record_count.toLocaleString()}</td>
                      <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 700, color: (c.periods_behind ?? 0) >= 3 ? "var(--red)" : (c.periods_behind ?? 0) >= 2 ? "var(--amber)" : "var(--ink-4)" }}>
                        {c.record_count === 0 ? "—" : c.periods_behind ?? 0}
                      </td>
                      <td style={{ fontSize: "var(--t-2xs)", fontFamily: "var(--font-mono)", color: "var(--amber)", maxWidth: 220 }}>
                        {c.gaps.length ? c.gaps.slice(0, 6).join(", ") + (c.gaps.length > 6 ? ` +${c.gaps.length - 6}` : "") : "—"}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <Link href={`/terminal/entry?series=${c.id}`} style={{ fontSize: "var(--t-2xs)", fontWeight: 700, color: "var(--green)" }}>Fill →</Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="chart-source">
          &quot;Behind&quot; is counted in the series&apos; own periods. Gaps are missing periods inside the range already
          covered — a series can look current and still be missing its middle.
        </div>
      </div>
    </div>
  );
}
