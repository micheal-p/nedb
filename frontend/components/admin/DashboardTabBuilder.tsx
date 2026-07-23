"use client";

// ── DashboardTabBuilder.tsx ─────────────────────────────────────────────────
// The no-code composer: create/edit custom dashboard tabs and fill them with
// widgets (chart / KPI / map) built from energy series, targeted at a whole
// profile or one account. Lives inside /admin/dashboards.

import { useState, useEffect, useCallback } from "react";
import { getTokenFresh } from "@/lib/auth";
import {
  SERIES_CATALOG, DASHBOARD_PROFILES, builderSlug,
  type BuilderTab, type BuilderWidget, type WidgetKind, type ChartType,
} from "@/lib/dashboard-builder";

type StaffLite = { username: string; full_name: string; agency?: string | null };
const CHART_TYPES: ChartType[] = ["line", "bar", "area", "column"];
const KINDS: { v: WidgetKind; label: string }[] = [
  { v: "chart", label: "Chart" }, { v: "kpi", label: "KPI tiles" }, { v: "map", label: "Nigeria map" },
];
const sel: React.CSSProperties = { padding: "6px 8px", border: "1px solid var(--border)", borderRadius: 5, fontSize: "0.76rem", background: "#fff" };
const inp: React.CSSProperties = { padding: "7px 9px", border: "1px solid var(--border)", borderRadius: 5, fontSize: "0.8rem", width: "100%", boxSizing: "border-box" };

const emptyWidget = (): BuilderWidget => ({ kind: "chart", title: "", config: { series: [], chartType: "line" }, display_order: 0 });
const emptyTab = (): BuilderTab => ({ scope: "profile", profile_key: "nuprc", label: "", slug: "", display_order: 0, widgets: [emptyWidget()] });

async function authed(url: string, init?: RequestInit) {
  const token = await getTokenFresh();
  return fetch(url, { ...init, credentials: "include", headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(init?.headers ?? {}) } });
}

export default function DashboardTabBuilder() {
  const [tabs, setTabs] = useState<BuilderTab[]>([]);
  const [staff, setStaff] = useState<StaffLite[]>([]);
  const [editing, setEditing] = useState<BuilderTab | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [acctSearch, setAcctSearch] = useState("");   // account picker: name/username
  const [acctAgency, setAcctAgency] = useState("");    // account picker: agency filter
  const [tabSearch, setTabSearch] = useState("");      // filter the custom-tabs list

  const load = useCallback(() => {
    authed("/api/dashboard/tabs?all=1").then((r) => (r.ok ? r.json() : { tabs: [] })).then((j) => setTabs(j.tabs ?? [])).catch(() => {});
  }, []);
  useEffect(() => {
    load();
    authed("/api/admin/users").then((r) => (r.ok ? r.json() : [])).then((rows: StaffLite[]) => setStaff(Array.isArray(rows) ? rows : [])).catch(() => {});
  }, [load]);

  function updateTab<K extends keyof BuilderTab>(k: K, v: BuilderTab[K]) { setEditing((t) => (t ? { ...t, [k]: v } : t)); }
  function updateWidget(i: number, patch: Partial<BuilderWidget>) {
    setEditing((t) => t ? { ...t, widgets: t.widgets.map((w, j) => (j === i ? { ...w, ...patch } : w)) } : t);
  }
  function updateWidgetSeries(i: number, id: string, on: boolean) {
    setEditing((t) => {
      if (!t) return t;
      const w = t.widgets[i];
      let series = w.config.series ?? [];
      if (w.kind !== "chart") series = on ? [id] : []; // kpi/map = single series (map), kpi allows many but keep simple: map single
      else series = on ? [...series, id] : series.filter((s) => s !== id);
      if (w.kind === "kpi") series = on ? [...(w.config.series ?? []), id] : (w.config.series ?? []).filter((s) => s !== id);
      return { ...t, widgets: t.widgets.map((x, j) => (j === i ? { ...x, config: { ...x.config, series } } : x)) };
    });
  }

  async function save() {
    if (!editing) return;
    setError(""); setSaving(true);
    try {
      const method = editing.id ? "PUT" : "POST";
      const r = await authed("/api/dashboard/tabs", { method, body: JSON.stringify({ ...editing, slug: editing.slug || builderSlug(editing.label) }) });
      const j = await r.json();
      if (!r.ok) { setError(j.error ?? "Save failed"); return; }
      setEditing(null); load();
    } catch { setError("Network error"); } finally { setSaving(false); }
  }
  async function remove(id?: number) {
    if (!id || !confirm("Delete this custom tab?")) return;
    await authed(`/api/dashboard/tabs?id=${id}`, { method: "DELETE" });
    load();
  }

  const staffOf = (username?: string | null) => staff.find((u) => u.username === username);
  const agencies = [...new Set(staff.map((u) => u.agency).filter(Boolean))].sort() as string[];
  const targetLabel = (t: BuilderTab) => {
    if (t.scope === "account") {
      const u = staffOf(t.owner_username);
      return `Account · ${u ? u.full_name : t.owner_username}${u?.agency ? ` (${u.agency})` : ""}`;
    }
    return `Profile · ${DASHBOARD_PROFILES.find((p) => p.key === t.profile_key)?.label ?? t.profile_key}`;
  };

  const filteredStaff = staff.filter((u) => {
    if (acctAgency && (u.agency ?? "") !== acctAgency) return false;
    if (!acctSearch.trim()) return true;
    const q = acctSearch.toLowerCase();
    return u.full_name.toLowerCase().includes(q) || u.username.toLowerCase().includes(q) || (u.agency ?? "").toLowerCase().includes(q);
  });

  const visibleTabs = tabs.filter((t) => {
    if (!tabSearch.trim()) return true;
    const q = tabSearch.toLowerCase();
    return t.label.toLowerCase().includes(q) || targetLabel(t).toLowerCase().includes(q);
  });

  return (
    <div style={{ marginBottom: "1.75rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, marginBottom: "0.75rem", flexWrap: "wrap" }}>
        <div>
          <h2 style={{ fontSize: "0.95rem", fontWeight: 700, color: "var(--ink)", margin: 0 }}>Custom Tabs</h2>
          <span style={{ fontSize: "0.72rem", color: "var(--ink-5)" }}>Add brand-new tabs to a profile or one account</span>
        </div>
        <button onClick={() => { setEditing(emptyTab()); setError(""); }} style={{ padding: "0.5rem 1.1rem", background: "var(--green)", color: "#fff", border: "none", borderRadius: 6, fontSize: "0.78rem", fontWeight: 700, cursor: "pointer" }}>+ New Tab</button>
      </div>

      {tabs.length === 0 ? (
        <div style={{ background: "#fff", border: "1px dashed var(--border)", borderRadius: "var(--r-md)", padding: "1.25rem", fontSize: "0.78rem", color: "var(--ink-5)" }}>
          No custom tabs yet. Click <strong>New Tab</strong> to compose one from energy series.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <input value={tabSearch} onChange={(e) => setTabSearch(e.target.value)} placeholder="Search tabs by name, person, agency or profile…"
            style={{ ...inp, marginBottom: "0.25rem" }} />
          {visibleTabs.length === 0 && <div style={{ fontSize: "0.75rem", color: "var(--ink-5)", padding: "0.5rem" }}>No custom tabs match “{tabSearch}”.</div>}
          {visibleTabs.map((t) => (
            <div key={t.id} style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: "var(--r-md)", padding: "0.875rem 1.1rem", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--ink)" }}>{t.label}</div>
                <div style={{ fontSize: "0.7rem", color: "var(--ink-4)" }}>{targetLabel(t)} · {t.widgets.length} widget{t.widgets.length === 1 ? "" : "s"}</div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => setEditing({ ...t, widgets: t.widgets.length ? t.widgets : [emptyWidget()] })} style={{ padding: "5px 12px", fontSize: "0.72rem", fontWeight: 700, border: "1px solid var(--green-line)", borderRadius: 4, background: "var(--green-tint)", color: "var(--green)", cursor: "pointer" }}>Edit</button>
                <button onClick={() => remove(t.id)} style={{ padding: "5px 12px", fontSize: "0.72rem", fontWeight: 700, border: "1px solid var(--red)", borderRadius: 4, background: "#fff", color: "var(--red)", cursor: "pointer" }}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 100, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "2rem 1rem", overflowY: "auto" }} onClick={() => setEditing(null)}>
          <div style={{ background: "#fff", borderRadius: "var(--r-lg)", width: "100%", maxWidth: 640, boxShadow: "0 24px 64px rgba(0,0,0,0.18)" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ padding: "1.1rem 1.4rem", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ fontSize: "1rem", fontWeight: 700, margin: 0 }}>{editing.id ? "Edit Tab" : "New Custom Tab"}</h3>
              <button onClick={() => setEditing(null)} style={{ background: "none", border: "none", fontSize: "1.2rem", cursor: "pointer", color: "var(--ink-4)" }}>×</button>
            </div>

            <div style={{ padding: "1.4rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                <div>
                  <label style={{ fontSize: "0.68rem", fontWeight: 600, color: "var(--ink-4)", display: "block", marginBottom: 3 }}>Tab name</label>
                  <input value={editing.label} onChange={(e) => updateTab("label", e.target.value)} placeholder="e.g. Gas Flaring" style={inp} />
                </div>
                <div>
                  <label style={{ fontSize: "0.68rem", fontWeight: 600, color: "var(--ink-4)", display: "block", marginBottom: 3 }}>Assign to</label>
                  <div style={{ display: "flex", gap: 6 }}>
                    <select value={editing.scope} onChange={(e) => updateTab("scope", e.target.value as "profile" | "account")} style={{ ...sel, width: 100 }}>
                      <option value="profile">Profile</option>
                      <option value="account">Account</option>
                    </select>
                    {editing.scope === "profile" && (
                      <select value={editing.profile_key ?? ""} onChange={(e) => updateTab("profile_key", e.target.value)} style={{ ...sel, flex: 1 }}>
                        {DASHBOARD_PROFILES.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
                      </select>
                    )}
                  </div>
                </div>
              </div>

              {/* Searchable account picker — filter by agency or name */}
              {editing.scope === "account" && (
                <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--r-md)", padding: "0.75rem 0.875rem" }}>
                  <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
                    <input value={acctSearch} onChange={(e) => setAcctSearch(e.target.value)} placeholder="Search staff by name or username…" style={{ ...inp, flex: "1 1 180px" }} />
                    <select value={acctAgency} onChange={(e) => setAcctAgency(e.target.value)} style={{ ...sel, flex: "0 0 auto" }}>
                      <option value="">All agencies</option>
                      {agencies.map((a) => <option key={a} value={a}>{a}</option>)}
                    </select>
                  </div>
                  <div style={{ maxHeight: 180, overflowY: "auto", border: "1px solid var(--border)", borderRadius: 5, background: "#fff" }}>
                    {filteredStaff.length === 0 && <div style={{ fontSize: "0.74rem", color: "var(--ink-5)", padding: "0.6rem 0.75rem" }}>No staff match.</div>}
                    {filteredStaff.map((u) => {
                      const on = editing.owner_username === u.username;
                      return (
                        <button key={u.username} onClick={() => updateTab("owner_username", u.username)}
                          style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, width: "100%", textAlign: "left", padding: "0.5rem 0.75rem", border: "none", borderBottom: "1px solid var(--border)", background: on ? "var(--green-tint)" : "#fff", cursor: "pointer" }}>
                          <span style={{ minWidth: 0 }}>
                            <span style={{ fontSize: "0.8rem", fontWeight: on ? 700 : 500, color: "var(--ink)" }}>{u.full_name}</span>
                            <span style={{ fontSize: "0.68rem", color: "var(--ink-5)", marginLeft: 6, fontFamily: "var(--font-mono)" }}>{u.username}</span>
                          </span>
                          <span style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                            {u.agency && <span style={{ fontSize: "0.62rem", color: "var(--ink-4)", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 3, padding: "1px 6px" }}>{u.agency}</span>}
                            {on && <span style={{ color: "var(--green)", fontWeight: 700 }}>✓</span>}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  {editing.owner_username && (
                    <div style={{ fontSize: "0.72rem", color: "var(--ink-3)", marginTop: 6 }}>
                      Assigning to <strong>{staffOf(editing.owner_username)?.full_name ?? editing.owner_username}</strong>
                    </div>
                  )}
                </div>
              )}

              <div style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.06em", borderBottom: "1px solid var(--border)", paddingBottom: 4 }}>Widgets</div>

              {editing.widgets.map((w, i) => (
                <div key={i} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--r-md)", padding: "0.875rem 1rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.625rem", gap: 8 }}>
                    <div style={{ display: "flex", gap: 6, alignItems: "center", flex: 1 }}>
                      <select value={w.kind} onChange={(e) => updateWidget(i, { kind: e.target.value as WidgetKind, config: { series: [], chartType: "line" } })} style={sel}>
                        {KINDS.map((k) => <option key={k.v} value={k.v}>{k.label}</option>)}
                      </select>
                      {w.kind === "chart" && (
                        <select value={w.config.chartType ?? "line"} onChange={(e) => updateWidget(i, { config: { ...w.config, chartType: e.target.value as ChartType } })} style={sel}>
                          {CHART_TYPES.map((c) => <option key={c} value={c}>{c}</option>)}
                        </select>
                      )}
                      <input value={w.title} onChange={(e) => updateWidget(i, { title: e.target.value })} placeholder="Widget title (optional)" style={{ ...inp, flex: 1 }} />
                    </div>
                    {editing.widgets.length > 1 && (
                      <button onClick={() => updateTab("widgets", editing.widgets.filter((_, j) => j !== i))} style={{ background: "none", border: "none", color: "var(--red)", fontSize: "0.72rem", cursor: "pointer" }}>Remove</button>
                    )}
                  </div>
                  <div style={{ fontSize: "0.66rem", color: "var(--ink-5)", marginBottom: 5 }}>
                    {w.kind === "map" ? "Pick one series to map by state" : w.kind === "kpi" ? "Pick series to show as KPI tiles" : "Pick one or more series to chart"}
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem 0.75rem" }}>
                    {SERIES_CATALOG.map((sc) => {
                      const on = (w.config.series ?? []).includes(sc.id);
                      const single = w.kind === "map";
                      return (
                        <label key={sc.id} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: "0.72rem", color: "var(--ink-3)", cursor: "pointer" }}>
                          <input type={single ? "radio" : "checkbox"} name={single ? `w${i}` : undefined} checked={on}
                            onChange={(e) => updateWidgetSeries(i, sc.id, single ? true : e.target.checked)}
                            style={{ accentColor: "var(--green)" }} />
                          {sc.label}
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}

              <button onClick={() => updateTab("widgets", [...editing.widgets, emptyWidget()])} style={{ padding: "0.5rem 1rem", background: "transparent", border: "1px dashed var(--border)", borderRadius: 6, fontSize: "0.76rem", fontWeight: 600, color: "var(--ink-4)", cursor: "pointer", alignSelf: "flex-start" }}>+ Add Widget</button>

              {error && <div style={{ fontSize: "0.76rem", color: "var(--red)", background: "var(--red-tint)", padding: "0.5rem 0.75rem", borderRadius: 5 }}>{error}</div>}
            </div>

            <div style={{ padding: "1rem 1.4rem", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "flex-end", gap: "0.75rem" }}>
              <button onClick={() => setEditing(null)} style={{ padding: "0.6rem 1.25rem", background: "none", border: "1px solid var(--border)", borderRadius: 6, fontSize: "0.8rem", color: "var(--ink-4)", cursor: "pointer" }}>Cancel</button>
              <button onClick={save} disabled={saving} style={{ padding: "0.6rem 1.5rem", background: saving ? "var(--ink-5)" : "var(--green)", color: "#fff", border: "none", borderRadius: 6, fontSize: "0.8rem", fontWeight: 700, cursor: saving ? "not-allowed" : "pointer" }}>{saving ? "Saving…" : "Save Tab"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
