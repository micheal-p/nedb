"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { isLoggedIn, getRole } from "@/lib/auth";

type ColumnDef = {
  name: string; slug: string; column_type: string; unit: string;
  is_required: boolean; is_readonly: boolean; display_order: number;
};

type CustomSeries = {
  id: number; slug: string; name: string; description: string;
  geo_resolution: string; is_public: boolean; created_by: string;
  created_at: string; column_count: number; record_count: number;
};

const COLUMN_TYPES = [
  { value: "text",      label: "Text" },
  { value: "numeric",   label: "Numeric" },
  { value: "date",      label: "Date" },
  { value: "select",    label: "Select (dropdown)" },
  { value: "cbn_rate",  label: "CBN Rate (auto-fill, readonly)" },
  { value: "lga_ref",   label: "LGA Reference" },
  { value: "state_ref", label: "State Reference" },
];

const GEO_OPTS = [
  { value: "national", label: "National" },
  { value: "state",    label: "State-level" },
  { value: "lga",      label: "LGA-level" },
];

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

function NewSeriesModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [step, setStep] = useState<"meta" | "columns">("meta");
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [desc, setDesc] = useState("");
  const [geo, setGeo] = useState("national");
  const [pub, setPub] = useState(true);
  const [columns, setColumns] = useState<ColumnDef[]>([
    { name: "Date", slug: "date", column_type: "date", unit: "", is_required: true, is_readonly: false, display_order: 1 },
  ]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function addColumn() {
    setColumns((cs) => [...cs, {
      name: "", slug: "", column_type: "text", unit: "", is_required: true, is_readonly: false,
      display_order: cs.length + 1,
    }]);
  }

  function updateCol(i: number, field: keyof ColumnDef, val: string | boolean | number) {
    setColumns((cs) => cs.map((c, j) => {
      if (j !== i) return c;
      const updated = { ...c, [field]: val };
      if (field === "name" && typeof val === "string") updated.slug = slugify(val);
      if (field === "column_type" && val === "cbn_rate") updated.is_readonly = true;
      return updated;
    }));
  }

  function removeCol(i: number) {
    setColumns((cs) => cs.filter((_, j) => j !== i).map((c, j) => ({ ...c, display_order: j + 1 })));
  }

  async function save() {
    setError("");
    if (!name.trim()) { setError("Name is required"); return; }
    if (!slug.trim()) { setError("Slug is required"); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/custom-series", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name: name.trim(), slug: slug.trim(), description: desc, geo_resolution: geo, is_public: pub, columns }),
      });
      if (!res.ok) {
        const j = await res.json();
        setError(j.error ?? "Failed to create series");
        return;
      }
      onCreated();
      onClose();
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }} onClick={onClose}>
      <div style={{ background: "#fff", borderRadius: "var(--r-lg)", width: "100%", maxWidth: 680, maxHeight: "90vh", overflow: "auto", boxShadow: "0 24px 64px rgba(0,0,0,0.18)" }} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={{ padding: "1.25rem 1.5rem", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--green)" }}>Custom Table Builder</div>
            <h2 style={{ fontSize: "1rem", fontWeight: 700, color: "var(--ink)", margin: 0 }}>Create New Data Series</h2>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink-4)", fontSize: "1.2rem" }}>×</button>
        </div>

        {/* Step tabs */}
        <div style={{ display: "flex", gap: 0, borderBottom: "1px solid var(--border)" }}>
          {(["meta", "columns"] as const).map((s) => (
            <button key={s} onClick={() => setStep(s)} style={{ flex: 1, padding: "0.75rem", fontSize: "0.78rem", fontWeight: step === s ? 700 : 400, color: step === s ? "var(--green)" : "var(--ink-4)", background: "none", border: "none", borderBottom: `2px solid ${step === s ? "var(--green)" : "transparent"}`, cursor: "pointer" }}>
              {s === "meta" ? "1. Series Info" : "2. Define Columns"}
            </button>
          ))}
        </div>

        <div style={{ padding: "1.5rem" }}>
          {step === "meta" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div>
                <label style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--ink-3)", display: "block", marginBottom: 4 }}>Series Name *</label>
                <input value={name} onChange={(e) => { setName(e.target.value); setSlug(slugify(e.target.value)); }} placeholder="e.g. CRUDE PRODUCTION SALES" style={{ width: "100%", padding: "8px 10px", border: "1px solid var(--border)", borderRadius: 6, fontSize: "0.85rem", fontFamily: "var(--font-sans)", boxSizing: "border-box" }} />
              </div>
              <div>
                <label style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--ink-3)", display: "block", marginBottom: 4 }}>Slug (auto-generated, must be unique) *</label>
                <input value={slug} onChange={(e) => setSlug(slugify(e.target.value))} placeholder="crude_production_sales" style={{ width: "100%", padding: "8px 10px", border: "1px solid var(--border)", borderRadius: 6, fontSize: "0.82rem", fontFamily: "var(--font-mono)", boxSizing: "border-box" }} />
              </div>
              <div>
                <label style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--ink-3)", display: "block", marginBottom: 4 }}>Description</label>
                <textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={3} placeholder="What records does this table hold?" style={{ width: "100%", padding: "8px 10px", border: "1px solid var(--border)", borderRadius: 6, fontSize: "0.82rem", resize: "vertical", fontFamily: "var(--font-sans)", boxSizing: "border-box" }} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                <div>
                  <label style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--ink-3)", display: "block", marginBottom: 4 }}>Geographic Resolution</label>
                  <select value={geo} onChange={(e) => setGeo(e.target.value)} style={{ width: "100%", padding: "8px 10px", border: "1px solid var(--border)", borderRadius: 6, fontSize: "0.82rem" }}>
                    {GEO_OPTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--ink-3)", display: "block", marginBottom: 4 }}>Visibility</label>
                  <select value={pub ? "public" : "private"} onChange={(e) => setPub(e.target.value === "public")} style={{ width: "100%", padding: "8px 10px", border: "1px solid var(--border)", borderRadius: 6, fontSize: "0.82rem" }}>
                    <option value="public">Public (visible on portal)</option>
                    <option value="private">Private (internal only)</option>
                  </select>
                </div>
              </div>
              <button onClick={() => setStep("columns")} style={{ padding: "0.6rem 1.5rem", background: "var(--green)", color: "#fff", border: "none", borderRadius: 6, fontSize: "0.82rem", fontWeight: 700, cursor: "pointer", alignSelf: "flex-end" }}>
                Next: Define Columns →
              </button>
            </div>
          )}

          {step === "columns" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
              <div style={{ fontSize: "0.78rem", color: "var(--ink-4)", background: "var(--surface)", padding: "0.75rem 1rem", borderRadius: "var(--r-md)", border: "1px solid var(--border)" }}>
                Define the columns for <strong>{name || "this series"}</strong>. Add a <strong>CBN Rate (auto-fill)</strong> column to have the USD/NGN exchange rate recorded automatically at entry time — staff cannot edit it.
              </div>

              {columns.map((col, i) => (
                <div key={i} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--r-md)", padding: "0.875rem 1rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.625rem" }}>
                    <span style={{ fontSize: "0.65rem", fontWeight: 700, color: "var(--ink-5)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Column {i + 1}</span>
                    {columns.length > 1 && (
                      <button onClick={() => removeCol(i)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--red)", fontSize: "0.75rem" }}>Remove</button>
                    )}
                  </div>
                  <div className="colgrid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 140px 80px", gap: "0.5rem", alignItems: "end" }}>
                    <div>
                      <label style={{ fontSize: "0.65rem", fontWeight: 600, color: "var(--ink-4)", display: "block", marginBottom: 2 }}>Label</label>
                      <input value={col.name} onChange={(e) => updateCol(i, "name", e.target.value)} placeholder="Column name" style={{ width: "100%", padding: "6px 8px", border: "1px solid var(--border)", borderRadius: 4, fontSize: "0.78rem", boxSizing: "border-box" }} />
                    </div>
                    <div>
                      <label style={{ fontSize: "0.65rem", fontWeight: 600, color: "var(--ink-4)", display: "block", marginBottom: 2 }}>Type</label>
                      <select value={col.column_type} onChange={(e) => updateCol(i, "column_type", e.target.value)} style={{ width: "100%", padding: "6px 8px", border: "1px solid var(--border)", borderRadius: 4, fontSize: "0.78rem" }}>
                        {COLUMN_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize: "0.65rem", fontWeight: 600, color: "var(--ink-4)", display: "block", marginBottom: 2 }}>Unit</label>
                      <input value={col.unit} onChange={(e) => updateCol(i, "unit", e.target.value)} placeholder="e.g. barrels" disabled={col.column_type === "cbn_rate"} style={{ width: "100%", padding: "6px 8px", border: "1px solid var(--border)", borderRadius: 4, fontSize: "0.78rem", boxSizing: "border-box", opacity: col.column_type === "cbn_rate" ? 0.4 : 1 }} />
                    </div>
                    <div>
                      <label style={{ fontSize: "0.65rem", fontWeight: 600, color: "var(--ink-4)", display: "block", marginBottom: 2 }}>Required</label>
                      <select value={col.is_required ? "yes" : "no"} onChange={(e) => updateCol(i, "is_required", e.target.value === "yes")} disabled={col.column_type === "cbn_rate"} style={{ width: "100%", padding: "6px 8px", border: "1px solid var(--border)", borderRadius: 4, fontSize: "0.78rem", opacity: col.column_type === "cbn_rate" ? 0.4 : 1 }}>
                        <option value="yes">Yes</option>
                        <option value="no">No</option>
                      </select>
                    </div>
                  </div>
                  {col.column_type === "cbn_rate" && (
                    <div style={{ marginTop: "0.5rem", fontSize: "0.7rem", color: "var(--green)", background: "var(--green-tint)", padding: "4px 8px", borderRadius: 4 }}>
                      This column will be automatically populated with the live CBN USD/NGN rate at the time of record entry. Staff cannot edit it.
                    </div>
                  )}
                </div>
              ))}

              <button onClick={addColumn} style={{ padding: "0.5rem 1rem", background: "transparent", border: "1px dashed var(--border)", borderRadius: 6, fontSize: "0.78rem", fontWeight: 600, color: "var(--ink-4)", cursor: "pointer" }}>
                + Add Column
              </button>

              {error && <div style={{ fontSize: "0.78rem", color: "var(--red)", background: "#FEE2E2", padding: "0.5rem 0.75rem", borderRadius: 4 }}>{error}</div>}

              <div style={{ display: "flex", gap: "0.75rem", justifyContent: "space-between" }}>
                <button onClick={() => setStep("meta")} style={{ padding: "0.6rem 1rem", background: "transparent", border: "1px solid var(--border)", borderRadius: 6, fontSize: "0.78rem", color: "var(--ink-4)", cursor: "pointer" }}>
                  ← Back
                </button>
                <button onClick={save} disabled={saving} style={{ padding: "0.6rem 1.5rem", background: saving ? "var(--ink-5)" : "var(--green)", color: "#fff", border: "none", borderRadius: 6, fontSize: "0.82rem", fontWeight: 700, cursor: saving ? "not-allowed" : "pointer" }}>
                  {saving ? "Creating…" : "Create Series"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function CustomTablesPage() {
  const router = useRouter();
  const [series, setSeries] = useState<CustomSeries[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/custom-series").then((r) => r.json()).then(setSeries).catch(() => {}).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!isLoggedIn()) { router.replace("/data-point/login?redirect=/admin/custom-tables"); return; }
    const role = getRole();
    if (role !== "admin" && role !== "staff") { router.replace("/data-point/dashboard"); return; }
    load();
  }, [router, load]);

  return (
    <div style={{ minHeight: "100vh", background: "var(--surface)", padding: "2rem" }}>
      {/* Header */}
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "2rem", flexWrap: "wrap", gap: "1rem" }}>
          <div>
            <div style={{ fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--green)", marginBottom: "0.25rem" }}>Admin</div>
            <h1 style={{ fontSize: "1.5rem", fontFamily: "var(--font-serif)", fontWeight: 400, color: "var(--ink)", margin: 0 }}>Custom Table Builder</h1>
            <p style={{ fontSize: "0.8rem", color: "var(--ink-4)", marginTop: "0.25rem" }}>Create structured data tables with custom columns. CBN rate columns auto-fill at entry time.</p>
          </div>
          <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
            <Link href="/admin" style={{ fontSize: "0.78rem", color: "var(--ink-4)", textDecoration: "none" }}>← Admin</Link>
            <button onClick={() => setShowNew(true)} style={{ padding: "0.6rem 1.25rem", background: "var(--green)", color: "#fff", border: "none", borderRadius: 6, fontSize: "0.82rem", fontWeight: 700, cursor: "pointer" }}>
              + New Series
            </button>
          </div>
        </div>

        {/* Table list */}
        {loading ? (
          <div style={{ textAlign: "center", padding: "3rem", color: "var(--ink-5)", fontSize: "0.82rem" }}>Loading…</div>
        ) : series.length === 0 ? (
          <div style={{ textAlign: "center", padding: "4rem 2rem", background: "#fff", border: "1px solid var(--border)", borderRadius: "var(--r-lg)" }}>
            <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>📊</div>
            <div style={{ fontSize: "0.9rem", fontWeight: 700, color: "var(--ink)", marginBottom: "0.375rem" }}>No custom series yet</div>
            <div style={{ fontSize: "0.8rem", color: "var(--ink-4)", marginBottom: "1.5rem" }}>Create your first custom data table — define columns, choose types, and start entering records.</div>
            <button onClick={() => setShowNew(true)} style={{ padding: "0.65rem 1.5rem", background: "var(--green)", color: "#fff", border: "none", borderRadius: 6, fontSize: "0.82rem", fontWeight: 700, cursor: "pointer" }}>
              Create First Series
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {series.map((s) => (
              <Link key={s.slug} href={`/admin/custom-tables/${s.slug}`} style={{ textDecoration: "none" }}>
                <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: "var(--r-md)", padding: "1.1rem 1.25rem", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem", cursor: "pointer", transition: "border-color 0.15s", flexWrap: "wrap" }}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--green)")}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--border)")}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: "0.2rem" }}>
                      <span style={{ fontSize: "0.9rem", fontWeight: 700, color: "var(--ink)" }}>{s.name}</span>
                      {!s.is_public && <span style={{ fontSize: "0.6rem", fontWeight: 700, background: "var(--surface)", border: "1px solid var(--border)", color: "var(--ink-4)", padding: "1px 6px", borderRadius: 3 }}>PRIVATE</span>}
                    </div>
                    <div style={{ fontSize: "0.72rem", color: "var(--ink-5)", fontFamily: "var(--font-mono)" }}>{s.slug}</div>
                    {s.description && <div style={{ fontSize: "0.75rem", color: "var(--ink-4)", marginTop: "0.25rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.description}</div>}
                  </div>
                  <div style={{ display: "flex", gap: "1.5rem", flexShrink: 0 }}>
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--ink)", fontFamily: "var(--font-mono)" }}>{s.column_count}</div>
                      <div style={{ fontSize: "0.62rem", color: "var(--ink-5)", textTransform: "uppercase" }}>Columns</div>
                    </div>
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--green)", fontFamily: "var(--font-mono)" }}>{s.record_count.toLocaleString()}</div>
                      <div style={{ fontSize: "0.62rem", color: "var(--ink-5)", textTransform: "uppercase" }}>Records</div>
                    </div>
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--ink-4)" }}>{s.geo_resolution}</div>
                      <div style={{ fontSize: "0.62rem", color: "var(--ink-5)", textTransform: "uppercase" }}>Geo</div>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {showNew && <NewSeriesModal onClose={() => setShowNew(false)} onCreated={load} />}
      </div>
      <style>{`
        @media (max-width: 640px) {
          .colgrid { grid-template-columns: 1fr 1fr !important; }
        }
      `}</style>
    </div>
  );
}
