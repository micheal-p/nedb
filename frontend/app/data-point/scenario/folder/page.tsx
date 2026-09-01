"use client";

// ── The planning folder ─────────────────────────────────────────────────────
// Every saved report, under the account's own name: timestamped, renameable,
// shareable by tokenised read-only link, deletable. The usage bar is honest —
// bytes actually stored against the quota — and more space is a request a
// superadmin decides, not a setting anyone quietly edits.

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { isLoggedIn, getTokenFresh } from "@/lib/auth";
import NecalGate from "@/components/necal/NecalGate";
import { encodeScenario, type Scenario } from "@/lib/necal-scenario";
import { EmptyState } from "@/components/ui/Loading";

type PlanFile = { id: number; filename: string; bytes: number; share_token: string | null; created_at: string };
type Usage = { usedBytes: number; quotaMb: number };

const mb = (bytes: number) => (bytes / 1048576).toFixed(2);

function FolderBody() {
  const router = useRouter();
  const [files, setFiles] = useState<PlanFile[]>([]);
  const [usage, setUsage] = useState<Usage>({ usedBytes: 0, quotaMb: 200 });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [renaming, setRenaming] = useState<number | null>(null);
  const [newName, setNewName] = useState("");
  const [reqOpen, setReqOpen] = useState(false);
  const [reqMb, setReqMb] = useState("500");
  const [reqReason, setReqReason] = useState("");

  const authed = useCallback(async (url: string, init?: RequestInit) => {
    const token = await getTokenFresh();
    return fetch(url, { ...init, credentials: "include", headers: { ...(init?.headers ?? {}), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(init?.body ? { "Content-Type": "application/json" } : {}) } });
  }, []);

  const load = useCallback(async () => {
    const r = await authed("/api/necal/files");
    if (r.ok) { const j = await r.json(); setFiles(j.files ?? []); setUsage(j.usage); }
    setLoading(false);
  }, [authed]);

  useEffect(() => {
    if (!isLoggedIn()) { router.replace("/data-point/login?redirect=/data-point/scenario/folder"); return; }
    load();
  }, [router, load]);

  async function openFile(f: PlanFile) {
    const r = await authed(`/api/necal/files/${f.id}`);
    if (!r.ok) { setMsg("Could not open the file."); return; }
    const j = await r.json();
    router.push(`/data-point/scenario/report?s=${encodeScenario(j.scenario as Scenario)}`);
  }

  async function rename(f: PlanFile) {
    setBusy(true);
    const r = await authed(`/api/necal/files/${f.id}`, { method: "PATCH", body: JSON.stringify({ filename: newName }) });
    setBusy(false); setRenaming(null);
    if (r.ok) { setMsg("Renamed."); load(); } else setMsg("Rename failed.");
  }

  async function share(f: PlanFile) {
    setBusy(true);
    const r = await authed(`/api/necal/files/${f.id}`, { method: "PATCH", body: JSON.stringify({ share: !f.share_token }) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { setMsg(j.error ?? "Failed."); return; }
    if (j.share_token) {
      const url = `${window.location.origin}/necal/shared/${f.id}?share=${j.share_token}`;
      try { await navigator.clipboard.writeText(url); setMsg("Share link copied — read-only, works without an account."); } catch { setMsg(url); }
    } else setMsg("Sharing stopped — the old link no longer works.");
    load();
  }

  async function remove(f: PlanFile) {
    setBusy(true);
    const r = await authed(`/api/necal/files/${f.id}`, { method: "DELETE" });
    setBusy(false);
    if (r.ok) { setMsg(`Deleted "${f.filename}" — ${mb(f.bytes)}MB freed.`); load(); } else setMsg("Delete failed.");
  }

  async function requestSpace() {
    setBusy(true);
    const r = await authed("/api/storage", { method: "POST", body: JSON.stringify({ requested_mb: Number(reqMb), reason: reqReason }) });
    const j = await r.json().catch(() => ({}));
    setBusy(false); setReqOpen(false);
    setMsg(r.ok ? j.message : (j.error ?? "Request failed."));
  }

  const usedPct = Math.min(100, (usage.usedBytes / (usage.quotaMb * 1048576)) * 100);

  return (
    <div style={{ minHeight: "100vh", background: "var(--surface)", padding: "2rem 1.25rem 4rem" }}>
      <div style={{ maxWidth: 860, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem", marginBottom: "1.5rem" }}>
          <div>
            <div className="eyebrow">NECAL2050 · Planning Folder</div>
            <h1 style={{ fontSize: "var(--t-xl)", fontWeight: 700, color: "var(--ink)", margin: 0 }}>My planning folder</h1>
            <p style={{ fontSize: "var(--t-sm)", color: "var(--ink-4)", marginTop: "0.35rem", maxWidth: "var(--measure)" }}>
              Saved reports under your name. Open one to regenerate its report exactly as saved, then Print / Save as PDF
              for the document itself.
            </p>
          </div>
          <Link href="/data-point/scenario" className="btn btn-secondary btn-sm">← Calculator</Link>
        </div>

        {/* Usage — honest bytes against the quota */}
        <div style={{ background: "var(--surface-white)", border: "1px solid var(--border)", padding: "1rem 1.25rem", marginBottom: "1.25rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: "0.5rem" }}>
            <span style={{ fontSize: "var(--t-sm)", fontWeight: 700, color: "var(--ink)" }}>
              Storage: {mb(usage.usedBytes)}MB of {usage.quotaMb}MB used
            </span>
            <button className="btn btn-secondary btn-sm" onClick={() => setReqOpen(!reqOpen)}>Request more space</button>
          </div>
          <div style={{ height: 8, background: "var(--surface-muted)", borderRadius: 2, marginTop: "0.6rem", overflow: "hidden" }} role="progressbar" aria-valuenow={Math.round(usedPct)} aria-valuemin={0} aria-valuemax={100} aria-label="Storage used">
            <div style={{ width: `${usedPct}%`, height: "100%", background: usedPct > 90 ? "var(--red)" : usedPct > 70 ? "var(--amber)" : "var(--green)" }} />
          </div>
          {reqOpen && (
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "flex-end", marginTop: "0.85rem", borderTop: "1px solid var(--border-soft)", paddingTop: "0.85rem" }}>
              <label style={{ flex: "0 1 140px" }}>
                <span className="form-label">Extra space (MB)</span>
                <input className="form-input" inputMode="numeric" value={reqMb} onChange={(e) => setReqMb(e.target.value.replace(/[^0-9]/g, ""))} />
              </label>
              <label style={{ flex: "1 1 260px" }}>
                <span className="form-label">Why you need it</span>
                <input className="form-input" value={reqReason} onChange={(e) => setReqReason(e.target.value)} placeholder="e.g. quarterly planning cycle, 40 scenario variants" />
              </label>
              <button className="btn btn-primary btn-sm" disabled={busy || !reqMb} onClick={requestSpace}>Send request</button>
              <span style={{ fontSize: "var(--t-xs)", color: "var(--ink-5)" }}>A superadmin decides allocations.</span>
            </div>
          )}
        </div>

        {msg && <div style={{ background: "var(--surface-white)", border: "1px solid var(--border)", padding: "0.6rem 1rem", fontSize: "var(--t-sm)", color: "var(--ink-2)", marginBottom: "1rem", wordBreak: "break-all" }}>{msg}</div>}

        {loading ? (
          <div style={{ textAlign: "center", padding: "2.5rem", color: "var(--ink-5)", fontSize: "var(--t-sm)" }}>Loading…</div>
        ) : files.length === 0 ? (
          <EmptyState
            title="Nothing saved yet"
            body="Generate a report in the calculator and use Save to my planning folder. Files are timestamped, renameable, and shareable by read-only link." />
        ) : (
          <div style={{ background: "var(--surface-white)", border: "1px solid var(--border)", overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "var(--t-sm)" }}>
              <thead><tr style={{ borderBottom: "1.5px solid var(--ink)", textAlign: "left" }}>
                <th style={{ padding: "8px 12px" }}>File</th>
                <th style={{ padding: "8px 12px" }}>Saved</th>
                <th style={{ padding: "8px 12px", textAlign: "right" }}>Size</th>
                <th style={{ padding: "8px 12px" }} />
              </tr></thead>
              <tbody>
                {files.map((f) => (
                  <tr key={f.id} style={{ borderBottom: "1px solid var(--border-soft)" }}>
                    <td style={{ padding: "9px 12px", minWidth: 260 }}>
                      {renaming === f.id ? (
                        <span style={{ display: "flex", gap: 6 }}>
                          <input className="form-input" value={newName} onChange={(e) => setNewName(e.target.value)} style={{ padding: "4px 8px", fontSize: "var(--t-sm)" }} />
                          <button className="btn btn-primary btn-sm" disabled={busy || !newName.trim()} onClick={() => rename(f)}>Save</button>
                          <button className="btn btn-secondary btn-sm" onClick={() => setRenaming(null)}>Cancel</button>
                        </span>
                      ) : (
                        <span style={{ fontWeight: 600, color: "var(--ink)" }}>
                          {f.filename}
                          {f.share_token && <span style={{ marginLeft: 8, fontSize: "var(--t-2xs)", fontWeight: 700, color: "var(--green)", border: "1px solid var(--green-line)", background: "var(--green-tint)", padding: "1px 6px", borderRadius: 2 }}>SHARED</span>}
                        </span>
                      )}
                    </td>
                    <td style={{ padding: "9px 12px", color: "var(--ink-4)", whiteSpace: "nowrap" }}>{new Date(f.created_at).toLocaleString("en-NG", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</td>
                    <td style={{ padding: "9px 12px", textAlign: "right", fontFamily: "var(--font-mono)" }}>{mb(f.bytes)}MB</td>
                    <td style={{ padding: "9px 12px", whiteSpace: "nowrap", textAlign: "right" }}>
                      <button className="btn btn-primary btn-sm" style={{ marginRight: 6 }} onClick={() => openFile(f)}>Open report</button>
                      <button className="btn btn-secondary btn-sm" style={{ marginRight: 6 }} onClick={() => { setRenaming(f.id); setNewName(f.filename); }}>Rename</button>
                      <button className="btn btn-secondary btn-sm" style={{ marginRight: 6 }} disabled={busy} onClick={() => share(f)}>{f.share_token ? "Stop sharing" : "Share"}</button>
                      <button className="btn btn-secondary btn-sm" style={{ color: "var(--red)" }} disabled={busy} onClick={() => remove(f)}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default function FolderPage() {
  return <NecalGate><FolderBody /></NecalGate>;
}
