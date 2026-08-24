"use client";

// ── /admin/dashboards — Dashboard Directory ─────────────────────────────────
// Directory of the per-entity dashboard fleet: every profile, who it is for,
// where it lands, and — honestly — how much of its headline data is live.
// Each card proves itself with a real coverage count from committed records
// and a Preview button that opens the actual dashboard in that profile.
// The no-code tab/widget composer (DashboardTabBuilder) sits above the list.
// Auth is enforced by the admin console shell (app/admin/layout.tsx).

import { useState, useEffect } from "react";
import Link from "next/link";
import DashboardTabBuilder from "@/components/admin/DashboardTabBuilder";
import { PROFILE_MAP } from "@/lib/dashboard-profiles";

const VIEW_LABEL: Record<string, string> = {
  overview: "Overview", upstream: "Upstream", downstream: "Downstream",
  power: "Power & Grid", renewable: "Renewables", revenue: "Revenue",
};

const GROUPS: { title: string; sub: string; keys: string[] }[] = [
  { title: "Government Agencies & Parastatals", sub: "Each regulator lands on its own mandate", keys: ["presidency","ecn","nerc","nuprc","nmdpra","nnpcl","nemic","nrs","rea","tcn","firs","nbs"] },
  { title: "Analyst Personas", sub: "Cross-sector staff views", keys: ["executive","petroleum","electricity","renewables","fiscal"] },
  { title: "Investor Personas", sub: "External / institutional audiences", keys: ["investor_fdi","investor_capital","investor_infra","investor_renewable"] },
];

export default function DashboardDirectoryPage() {
  // Which series have committed records — the basis of each card's coverage
  const [liveSeries, setLiveSeries] = useState<Set<string> | null>(null);

  useEffect(() => {
    // The route is per-year; coverage means "any committed data in the most
    // recent year that has records", so resolve the latest year first.
    (async () => {
      try {
        const first = await fetch("/api/dashboard-data").then((r) => r.json());
        const years: number[] = first.years ?? [];
        const latest = years.length ? Math.max(...years) : null;
        const payload = latest && latest !== first.year ? await fetch(`/api/dashboard-data?year=${latest}`).then((r) => r.json()) : first;
        const series = (payload.series ?? {}) as Record<string, unknown[]>;
        setLiveSeries(new Set(Object.keys(series).filter((k) => (series[k] ?? []).length > 0)));
      } catch {
        setLiveSeries(new Set());
      }
    })();
  }, []);

  return (
    <div style={{ background: "var(--surface)", minHeight: "100%", padding: "2rem" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ marginBottom: "1.5rem" }}>
          <div style={{ fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--ink-4)", marginBottom: "0.25rem" }}>Dashboards</div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--ink)", margin: 0 }}>Dashboard Directory</h1>
          <p style={{ fontSize: "0.82rem", color: "var(--ink-4)", marginTop: "0.35rem", maxWidth: 640, lineHeight: 1.6 }}>
            One engine, {Object.keys(PROFILE_MAP).length} tailored dashboards. Each entity lands on its own view with its own headline
            indicators; coverage counts below come from committed records. Assign a profile to any staff account under <Link href="/admin" style={{ color: "var(--green)" }}>Administration → Users</Link>.
          </p>
        </div>

        <DashboardTabBuilder />

        <div style={{ display: "flex", alignItems: "baseline", gap: 10, margin: "0.5rem 0 0.75rem" }}>
          <h2 style={{ fontSize: "0.95rem", fontWeight: 700, color: "var(--ink)", margin: 0 }}>Built-in Profiles</h2>
          <span style={{ fontSize: "0.72rem", color: "var(--ink-5)" }}>The {Object.keys(PROFILE_MAP).length} standard dashboards custom tabs attach to</span>
        </div>

        {GROUPS.map((g) => (
          <div key={g.title} style={{ marginBottom: "1.75rem" }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: "0.75rem" }}>
              <h2 style={{ fontSize: "0.95rem", fontWeight: 700, color: "var(--ink)", margin: 0 }}>{g.title}</h2>
              <span style={{ fontSize: "0.72rem", color: "var(--ink-5)" }}>{g.sub}</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "0.75rem" }}>
              {g.keys.map((k) => {
                const p = PROFILE_MAP[k];
                if (!p) return null;
                const live = liveSeries ? p.kpis.filter((d) => liveSeries.has(d.series)).length : null;
                const total = p.kpis.length;
                return (
                  <div key={k} style={{ background: "var(--surface-white)", border: "1px solid var(--border)", borderRadius: "var(--r-md)", padding: "1rem 1.1rem", minWidth: 0, display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                    <div>
                      <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--ink)", marginBottom: 4 }}>{p.label}</div>
                      <div style={{ fontSize: "0.72rem", color: "var(--ink-4)", lineHeight: 1.5, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{p.persona}</div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                      <span style={{ fontSize: "0.6rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--ink-5)" }}>Lands on</span>
                      <span style={{ fontSize: "0.68rem", fontWeight: 700, color: "var(--green)", background: "var(--green-tint)", border: "1px solid var(--green-line)", borderRadius: 2, padding: "1px 7px" }}>{VIEW_LABEL[p.defaultView] ?? p.defaultView}</span>
                      <code style={{ fontSize: "0.62rem", color: "var(--ink-5)", fontFamily: "var(--font-mono)", marginLeft: "auto" }}>{k}</code>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, borderTop: "1px solid var(--border-soft)", paddingTop: "0.55rem", marginTop: "auto" }}>
                      <span style={{ fontSize: "0.7rem", fontWeight: 600, color: live == null ? "var(--ink-5)" : live === total ? "var(--green)" : live > 0 ? "var(--amber)" : "var(--red)" }}>
                        {live == null ? "Checking coverage…" : `${live} of ${total} indicators have data`}
                      </span>
                      <Link href={`/data-point/dashboard?profile=${k}`} style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--green)", textDecoration: "underline", textUnderlineOffset: 2, whiteSpace: "nowrap" }}>
                        Preview
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
