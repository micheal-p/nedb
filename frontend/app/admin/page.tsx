"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, type StaffUser } from "@/lib/api";
import { getToken, getRole, getFullName } from "@/lib/auth";
import CoatOfArms from "@/components/layout/CoatOfArms";

interface Company {
  id: number; company: string; oml_blocks: string | null;
  operator_type: string; sector: string; status: string; created_by: string | null;
}

const PROFILES = [
  // Agencies & Parastatals
  { value: "presidency",  label: "Presidency / State House — national energy security brief" },
  { value: "ecn",         label: "ECN — Energy Commission of Nigeria (policy, all sectors)" },
  { value: "nerc",        label: "NERC — Electricity Regulatory Commission (market regulation)" },
  { value: "nuprc",       label: "NUPRC — Upstream Petroleum Regulatory Commission" },
  { value: "nmdpra",      label: "NMDPRA — Midstream & Downstream Petroleum Regulator" },
  { value: "nnpcl",       label: "NNPC Limited — operational & commercial intelligence" },
  { value: "nemic",       label: "NEMIC — Energy Management & Infrastructure" },
  { value: "nrs",         label: "NRS — Natural Resources Statistics" },
  { value: "rea",         label: "REA — Rural Electrification Agency (off-grid, renewables)" },
  { value: "tcn",         label: "TCN — Transmission Company of Nigeria (grid intelligence)" },
  { value: "firs",        label: "FIRS — Federal Inland Revenue Service (PPT, royalties, FAAC)" },
  { value: "nbs",         label: "NBS — National Bureau of Statistics (energy sector data)" },
  // Generic sector profiles
  { value: "executive",   label: "Executive Overview — cross-sector national intelligence" },
  { value: "petroleum",   label: "Petroleum & Gas Analyst — crude, PMS/AGO/LPG" },
  { value: "electricity", label: "Power & Grid Analyst — generation, DisCo performance" },
  { value: "renewables",  label: "Clean Energy Analyst — renewables, gas, biomass" },
  { value: "fiscal",      label: "Fiscal & Revenue Analyst — FAAC, royalties, upstream revenue" },
  // Investor profiles
  { value: "investor_fdi",       label: "Investor — FDI Intelligence (IOCs, sovereign wealth funds)" },
  { value: "investor_capital",   label: "Investor — Capital Markets (equities, fixed income)" },
  { value: "investor_infra",     label: "Investor — Infrastructure / Power Sector (IPPs, DisCo acquirers)" },
  { value: "investor_renewable", label: "Investor — Renewable Energy (solar, wind, mini-grid developers)" },
];

const EMPTY_USER = { username: "", full_name: "", email: "", role: "staff", agency: "", password: "", dashboard_profile: "executive" };
const EMPTY_CO   = { company: "", oml_blocks: "", operator_type: "IOC JV", sector: "Upstream", status: "Active" };

// ── Nigeria geopolitical zones ────────────────────────────────
const NG_ZONES: Record<string, string[]> = {
  "North West":    ["Jigawa", "Kaduna", "Kano", "Katsina", "Kebbi", "Sokoto", "Zamfara"],
  "North East":    ["Adamawa", "Bauchi", "Borno", "Gombe", "Taraba", "Yobe"],
  "North Central": ["Benue", "FCT (Abuja)", "Kogi", "Kwara", "Nasarawa", "Niger", "Plateau"],
  "South West":    ["Ekiti", "Lagos", "Ogun", "Ondo", "Osun", "Oyo"],
  "South East":    ["Abia", "Anambra", "Ebonyi", "Enugu", "Imo"],
  "South South":   ["Akwa Ibom", "Bayelsa", "Cross River", "Delta", "Edo", "Rivers"],
};
const STATE_TO_ZONE: Record<string, string> = {};
Object.entries(NG_ZONES).forEach(([z, states]) => states.forEach((s) => { STATE_TO_ZONE[s] = z; }));
const ALL_STATES = Object.values(NG_ZONES).flat().sort();

// ── Series type metadata ──────────────────────────────────────
const SERIES_META: Record<string, { name: string; unit: string; freq: string; fuel_product?: string }> = {
  crude_oil_production:   { name: "Crude Oil Production",         unit: "M Barrels",  freq: "monthly"   },
  natural_gas_production: { name: "Natural Gas Production",       unit: "Bcf",         freq: "monthly"   },
  pms_sales:              { name: "PMS (Petrol) Sales",           unit: "M Litres",    freq: "monthly",  fuel_product: "PMS" },
  ago_sales:              { name: "AGO (Diesel) Sales",           unit: "M Litres",    freq: "monthly",  fuel_product: "AGO" },
  kerosine_sales:         { name: "Kerosene / DPK Sales",         unit: "M Litres",    freq: "monthly",  fuel_product: "DPK" },
  lpg_sales:              { name: "LPG Sales",                    unit: "MT",          freq: "monthly",  fuel_product: "LPG" },
  electricity_generation: { name: "Electricity Generation",       unit: "GWh",         freq: "monthly"   },
  electricity_sent_out:   { name: "Electricity Sent Out",         unit: "GWh",         freq: "monthly"   },
  electricity_consumption:{ name: "Electricity Consumption",      unit: "GWh",         freq: "monthly"   },
  renewable_energy:       { name: "Renewable Energy Capacity",    unit: "MW",          freq: "quarterly" },
  fuelwood_consumption:   { name: "Fuelwood Consumption",         unit: "M m³",        freq: "quarterly" },
  faac_oil_revenue:       { name: "FAAC Oil Revenue",             unit: "₦ Billion",   freq: "quarterly" },
  upstream_royalties:     { name: "Upstream Royalties Collected", unit: "₦ Billion",   freq: "quarterly" },
};

function buildPeriodOptions(freq: string, year: number): string[] {
  const MONTHS = ["01","02","03","04","05","06","07","08","09","10","11","12"];
  if (freq === "monthly")   return MONTHS.map((m) => `${year}-${m}`);
  if (freq === "quarterly") return ["Q1","Q2","Q3","Q4"].map((q) => `${year}-${q}`);
  return [`${year}`];
}
function periodToDate(period: string): string {
  if (/^\d{4}-\d{2}$/.test(period)) return `${period}-01`;
  if (/^\d{4}-Q(\d)$/.test(period)) {
    const q = parseInt(period.split("-Q")[1]);
    return `${period.split("-")[0]}-${String((q - 1) * 3 + 1).padStart(2, "0")}-01`;
  }
  return `${period}-01-01`;
}

const ENTRY_YEARS = [2020, 2021, 2022, 2023, 2024, 2025, 2026];
const ENTRY_INIT = { series_type_id: "crude_oil_production", year: 2026, period: "", value: "", state: "NGA", region: "", source: "", notes: "" };

export default function AdminPage() {
  const router = useRouter();
  const [tab, setTab] = useState<"users" | "registry" | "requests" | "entry" | "iot">("users");
  const [copied, setCopied] = useState<string | null>(null);

  function copyToClipboard(text: string, label: string) {
    navigator.clipboard.writeText(text).then(() => { setCopied(label); setTimeout(() => setCopied(null), 2000); });
  }

  // Access requests state
  interface AccessRequest { id: number; full_name: string; email: string; organisation: string; position: string | null; profile_key: string; justification: string | null; status: string; created_at: string; temp_username: string | null }
  const [requests, setRequests]       = useState<AccessRequest[]>([]);
  const [reqLoading, setReqLoading]   = useState(false);
  const [approveId, setApproveId]     = useState<number | null>(null);
  const [approvePwd, setApprovePwd]   = useState("");
  const [approvedUser, setApprovedUser] = useState<string | null>(null);

  // Users state
  const [users, setUsers]         = useState<StaffUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [showUserForm, setShowUserForm] = useState(false);
  const [userForm, setUserForm]   = useState(EMPTY_USER);
  const [resetId, setResetId]     = useState<number | null>(null);
  const [newPwd, setNewPwd]       = useState("");

  // Registry state
  const [companies, setCompanies] = useState<Company[]>([]);
  const [regLoading, setRegLoading] = useState(true);
  const [showCoForm, setShowCoForm] = useState(false);
  const [coForm, setCoForm]       = useState(EMPTY_CO);
  const [editId, setEditId]       = useState<number | null>(null);

  // Edit user state
  const [editUserId, setEditUserId] = useState<number | null>(null);
  const [editUserForm, setEditUserForm] = useState({ full_name: "", email: "", agency: "", role: "viewer", dashboard_profile: "executive" });

  // Data entry state
  const [entryForm, setEntryForm]     = useState(ENTRY_INIT);
  const [entrySubmitting, setEntrySubmitting] = useState(false);
  const [entryMsg, setEntryMsg]       = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg]              = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const adminName = getFullName() || "Administrator";

  const loadUsers = useCallback(async () => {
    const token = getToken();
    if (!token) { router.replace("/data-point/login?redirect=/admin"); return; }
    if (getRole() !== "admin") { router.replace("/"); return; }
    setUsersLoading(true);
    const data = await api.listStaff(token).catch(() => []);
    setUsers(data);
    setUsersLoading(false);
  }, [router]);

  const loadCompanies = useCallback(async () => {
    setRegLoading(true);
    const r = await fetch("/api/registry");
    setCompanies(r.ok ? await r.json() : []);
    setRegLoading(false);
  }, []);

  const loadRequests = useCallback(async (status = "pending") => {
    const token = getToken(); if (!token) return;
    setReqLoading(true);
    const r = await fetch(`/api/access-requests?status=${status}`, { headers: { Authorization: `Bearer ${token}` } });
    setRequests(r.ok ? await r.json() : []);
    setReqLoading(false);
  }, []);

  useEffect(() => {
    const token = getToken();
    if (!token) { router.replace("/data-point/login?redirect=/admin"); return; }
    if (getRole() !== "admin") { router.replace("/"); return; }
    loadUsers();
    loadCompanies();
    loadRequests();
  }, [router, loadUsers, loadCompanies, loadRequests]);

  // ── User actions ──────────────────────────────────────────────
  async function createUser(e: React.FormEvent) {
    e.preventDefault();
    const token = getToken(); if (!token) return;
    setSubmitting(true); setMsg(null);
    try {
      await api.createStaff(userForm, token);
      setMsg({ type: "ok", text: `Account created for ${userForm.full_name} (${userForm.username}).` });
      setUserForm(EMPTY_USER); setShowUserForm(false); loadUsers();
    } catch (err) {
      setMsg({ type: "err", text: err instanceof Error ? err.message : "Failed to create account." });
    } finally { setSubmitting(false); }
  }

  async function toggleUser(id: number) {
    const token = getToken(); if (!token) return;
    await api.toggleStaff(id, token); loadUsers();
  }

  async function doResetPassword() {
    if (!resetId || !newPwd) return;
    const token = getToken(); if (!token) return;
    await api.resetPassword(resetId, newPwd, token);
    setMsg({ type: "ok", text: "Password reset successfully." });
    setResetId(null); setNewPwd("");
  }

  // ── Access request actions ────────────────────────────────────
  async function approveRequest() {
    if (!approveId || approvePwd.length < 6) return;
    const token = getToken(); if (!token) return;
    setSubmitting(true); setMsg(null);
    try {
      const r = await fetch(`/api/access-requests/${approveId}`, {
        method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: "approve", password: approvePwd }),
      });
      const data = await r.json();
      if (!r.ok) { setMsg({ type: "err", text: data.error ?? "Failed to approve" }); return; }
      setApprovedUser(data.username);
      setApprovePwd(""); setApproveId(null); loadRequests(); loadUsers();
    } catch { setMsg({ type: "err", text: "Network error" }); }
    finally { setSubmitting(false); }
  }

  async function rejectRequest(id: number) {
    const token = getToken(); if (!token) return;
    await fetch(`/api/access-requests/${id}`, {
      method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ action: "reject" }),
    });
    loadRequests();
  }

  // ── Registry actions ──────────────────────────────────────────
  async function saveCompany(e: React.FormEvent) {
    e.preventDefault();
    const token = getToken(); if (!token) return;
    setSubmitting(true); setMsg(null);
    try {
      const url  = editId ? `/api/registry/${editId}` : "/api/registry";
      const method = editId ? "PUT" : "POST";
      const r = await fetch(url, {
        method, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(coForm),
      });
      if (!r.ok) throw new Error((await r.json()).error ?? "Failed");
      setMsg({ type: "ok", text: editId ? "Company updated." : `${coForm.company} added to registry.` });
      setCoForm(EMPTY_CO); setShowCoForm(false); setEditId(null); loadCompanies();
    } catch (err) {
      setMsg({ type: "err", text: err instanceof Error ? err.message : "Failed." });
    } finally { setSubmitting(false); }
  }

  async function deleteCompany(id: number, name: string) {
    if (!confirm(`Remove "${name}" from the registry?`)) return;
    const token = getToken(); if (!token) return;
    await fetch(`/api/registry/${id}`, {
      method: "DELETE", headers: { Authorization: `Bearer ${token}` },
    });
    setMsg({ type: "ok", text: `${name} removed.` });
    loadCompanies();
  }

  function startEditCompany(c: Company) {
    setCoForm({ company: c.company, oml_blocks: c.oml_blocks ?? "", operator_type: c.operator_type, sector: c.sector, status: c.status });
    setEditId(c.id); setShowCoForm(true); setMsg(null);
  }

  function startEditUser(u: StaffUser) {
    setEditUserForm({ full_name: u.full_name, email: u.email ?? "", agency: u.agency ?? "", role: u.role, dashboard_profile: u.dashboard_profile ?? "executive" });
    setEditUserId(u.id);
  }

  async function saveEditUser(e: React.FormEvent) {
    e.preventDefault();
    const token = getToken(); if (!token || !editUserId) return;
    setSubmitting(true); setMsg(null);
    try {
      const r = await fetch(`/api/admin/users/${editUserId}/edit`, {
        method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(editUserForm),
      });
      if (!r.ok) throw new Error((await r.json()).error ?? "Failed");
      setMsg({ type: "ok", text: "User updated successfully." });
      setEditUserId(null); loadUsers();
    } catch (err) {
      setMsg({ type: "err", text: err instanceof Error ? err.message : "Failed to update user." });
    } finally { setSubmitting(false); }
  }

  async function doManualEntry(e: React.FormEvent) {
    e.preventDefault();
    const token = getToken(); if (!token) return;
    if (!entryForm.period || !entryForm.value) { setEntryMsg({ type: "err", text: "Period and value are required." }); return; }
    setEntrySubmitting(true); setEntryMsg(null);
    const meta = SERIES_META[entryForm.series_type_id];
    const row = {
      period:      entryForm.period,
      period_date: periodToDate(entryForm.period),
      value:       parseFloat(entryForm.value),
      unit:        meta.unit,
      region:      entryForm.state === "NGA" ? "NGA" : entryForm.state,
      source:      entryForm.source || undefined,
      notes:       entryForm.notes  || undefined,
      ...(meta.fuel_product ? { fuel_product: meta.fuel_product } : {}),
    };
    try {
      const r = await fetch("/api/upload/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ series_type_id: entryForm.series_type_id, rows: [row] }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "Failed");
      setEntryMsg({ type: "ok", text: `Record committed — ${meta.name} · ${entryForm.period} · ${entryForm.value} ${meta.unit}` });
      setEntryForm((f) => ({ ...f, period: "", value: "", notes: "" }));
    } catch (err) {
      setEntryMsg({ type: "err", text: err instanceof Error ? err.message : "Failed to save record." });
    } finally { setEntrySubmitting(false); }
  }

  const TAB_STYLE = (active: boolean): React.CSSProperties => ({
    padding: "0.5rem 1.25rem", fontSize: "0.8rem", fontWeight: 600, cursor: "pointer",
    background: active ? "var(--surface-white)" : "transparent",
    color: active ? "var(--green)" : "var(--ink-4)",
    border: "none", borderBottom: active ? "2px solid var(--green)" : "2px solid transparent",
    marginBottom: -1, transition: "color 0.15s",
  });

  return (
    <div style={{ minHeight: "100vh", background: "var(--surface)" }}>
      {/* Header */}
      <div style={{ background: "var(--ink)", borderBottom: "3px solid var(--green)", padding: "0 2rem" }}>
        <div style={{ maxWidth: "var(--max-w)", margin: "0 auto", height: 60, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <CoatOfArms size={36} />
            <div>
              <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "#fff" }}>NEDB Administrator</div>
              <div style={{ fontSize: "0.62rem", color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Energy Commission of Nigeria</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ fontSize: "0.78rem", color: "rgba(255,255,255,0.5)" }}>{adminName}</span>
            <Link href="/upload" className="btn btn-ghost btn-sm">Upload Data</Link>
            <Link href="/data-point/dashboard" className="btn btn-ghost btn-sm">Dashboard</Link>
            <Link href="/" className="btn btn-ghost btn-sm">Public Site</Link>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: "var(--max-w)", margin: "0 auto", padding: "2rem 2rem" }}>

        {/* Tab bar */}
        <div style={{ borderBottom: "1px solid var(--border)", marginBottom: "2rem", display: "flex", gap: 0 }}>
          <button style={TAB_STYLE(tab === "users")}    onClick={() => { setTab("users"); setMsg(null); }}>Portal Users</button>
          <button style={TAB_STYLE(tab === "entry")}    onClick={() => { setTab("entry"); setMsg(null); setEntryMsg(null); }}>Data Entry</button>
          <button style={TAB_STYLE(tab === "iot")}      onClick={() => { setTab("iot"); setMsg(null); }}>IoT / API</button>
          <button style={TAB_STYLE(tab === "registry")} onClick={() => { setTab("registry"); setMsg(null); }}>Companies Registry</button>
          <button style={TAB_STYLE(tab === "requests")} onClick={() => { setTab("requests"); loadRequests(); setMsg(null); }}>
            Access Requests
            {requests.filter((r) => r.status === "pending").length > 0 && (
              <span style={{ marginLeft: 6, background: "#C0392B", color: "#fff", borderRadius: 10, padding: "1px 7px", fontSize: "0.65rem", fontWeight: 700 }}>{requests.filter((r) => r.status === "pending").length}</span>
            )}
          </button>
        </div>

        {/* Global message */}
        {msg && (
          <div style={{ marginBottom: "1.5rem", padding: "0.875rem 1rem", background: msg.type === "ok" ? "var(--green-strong)" : "var(--red-tint)", border: `1px solid ${msg.type === "ok" ? "var(--green-line)" : "rgba(192,57,43,0.2)"}`, borderRadius: "var(--r-md)", fontSize: "0.82rem", color: msg.type === "ok" ? "var(--green-deep)" : "var(--red)" }}>
            {msg.text}
          </div>
        )}

        {/* ── USERS TAB ── */}
        {tab === "users" && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.5rem", flexWrap: "wrap", gap: "1rem" }}>
              <div>
                <h1 style={{ fontFamily: "var(--font-serif)", fontSize: "1.5rem", fontWeight: 400, color: "var(--ink)", marginBottom: "0.25rem" }}>Portal Users</h1>
                <p style={{ fontSize: "0.8rem", color: "var(--ink-4)" }}>
                  Create accounts and assign landing portals. <strong>Energy Staff</strong> go to the Upload Portal. <strong>Data Point Viewers</strong> go to the Intelligence Dashboard.
                </p>
              </div>
              <button className="btn btn-primary" onClick={() => { setShowUserForm(!showUserForm); setMsg(null); }}>
                {showUserForm ? "Cancel" : "Create Account"}
              </button>
            </div>

            {showUserForm && (
              <div className="panel" style={{ marginBottom: "1.5rem" }}>
                <div className="panel-header"><span className="panel-title">New Account</span></div>
                <div className="panel-body">
                  <form onSubmit={createUser}>
                    <div className="admin-form-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem 1.5rem" }}>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Full Name</label>
                        <input className="form-input" placeholder="e.g. Adeola Okafor" required value={userForm.full_name} onChange={(e) => setUserForm({ ...userForm, full_name: e.target.value })} />
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Username</label>
                        <input className="form-input" placeholder="e.g. aokafor" required value={userForm.username} onChange={(e) => setUserForm({ ...userForm, username: e.target.value.toLowerCase().replace(/\s/g, "") })} />
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Email Address</label>
                        <input className="form-input" type="email" required value={userForm.email} onChange={(e) => setUserForm({ ...userForm, email: e.target.value })} />
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Agency</label>
                        <input className="form-input" placeholder="ECN, NUPRC, NERC…" value={userForm.agency} onChange={(e) => setUserForm({ ...userForm, agency: e.target.value })} />
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Landing Portal</label>
                        <select className="form-input form-select" value={userForm.role} onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}>
                          <option value="staff">Staff Upload Portal — uploads energy datasets</option>
                          <option value="viewer">Data Point Dashboard — analytics & intelligence</option>
                          <option value="admin">Administrator — full access to all areas</option>
                        </select>
                      </div>
                      {userForm.role === "viewer" && (
                        <div className="form-group" style={{ marginBottom: 0, gridColumn: "1 / -1" }}>
                          <label className="form-label">Dashboard Profile</label>
                          <select className="form-input form-select" value={userForm.dashboard_profile} onChange={(e) => setUserForm({ ...userForm, dashboard_profile: e.target.value })}>
                            {PROFILES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                          </select>
                          <p style={{ fontSize: "0.72rem", color: "var(--ink-4)", marginTop: "0.4rem" }}>
                            Determines which personalised dashboard the viewer sees after login.
                          </p>
                        </div>
                      )}
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Temporary Password</label>
                        <input className="form-input" type="password" placeholder="Min. 8 characters" required minLength={8} value={userForm.password} onChange={(e) => setUserForm({ ...userForm, password: e.target.value })} />
                      </div>
                    </div>
                    <div style={{ marginTop: "1.25rem", display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
                      <button type="submit" className="btn btn-primary" disabled={submitting}>{submitting ? "Creating…" : "Create Account"}</button>
                      <button type="button" className="btn btn-secondary" onClick={() => setShowUserForm(false)}>Cancel</button>
                    </div>
                    <p style={{ fontSize: "0.72rem", color: "var(--ink-4)", marginTop: "0.75rem" }}>
                      All users log in at the same page. Landing Portal determines where they go after login. Every upload is attributed to the staff member by name.
                    </p>
                  </form>
                </div>
              </div>
            )}

            {resetId && (
              <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
                <div className="panel" style={{ width: 400, boxShadow: "var(--shadow-3)" }}>
                  <div className="panel-header"><span className="panel-title">Reset Password</span></div>
                  <div className="panel-body">
                    <div className="form-group">
                      <label className="form-label">New Password</label>
                      <input className="form-input" type="password" placeholder="Min. 8 characters" minLength={8} value={newPwd} onChange={(e) => setNewPwd(e.target.value)} autoFocus />
                    </div>
                    <div style={{ display: "flex", gap: "0.75rem", marginTop: "1rem" }}>
                      <button className="btn btn-primary" onClick={doResetPassword} disabled={newPwd.length < 8}>Reset Password</button>
                      <button className="btn btn-secondary" onClick={() => { setResetId(null); setNewPwd(""); }}>Cancel</button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Edit User modal */}
            {editUserId && (
              <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
                <div className="panel" style={{ width: 520, boxShadow: "var(--shadow-3)" }}>
                  <div className="panel-header"><span className="panel-title">Edit User Profile & Access</span></div>
                  <div className="panel-body">
                    <form onSubmit={saveEditUser}>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem 1.5rem" }}>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label className="form-label">Full Name</label>
                          <input className="form-input" required value={editUserForm.full_name} onChange={(e) => setEditUserForm({ ...editUserForm, full_name: e.target.value })} />
                        </div>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label className="form-label">Email</label>
                          <input className="form-input" type="email" value={editUserForm.email} onChange={(e) => setEditUserForm({ ...editUserForm, email: e.target.value })} />
                        </div>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label className="form-label">Agency</label>
                          <input className="form-input" placeholder="ECN, NUPRC…" value={editUserForm.agency} onChange={(e) => setEditUserForm({ ...editUserForm, agency: e.target.value })} />
                        </div>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label className="form-label">Role / Landing Portal</label>
                          <select className="form-input form-select" value={editUserForm.role} onChange={(e) => setEditUserForm({ ...editUserForm, role: e.target.value })}>
                            <option value="staff">Staff — Upload Portal</option>
                            <option value="viewer">Viewer — Data Point Dashboard</option>
                            <option value="admin">Administrator</option>
                          </select>
                        </div>
                        <div className="form-group" style={{ marginBottom: 0, gridColumn: "1 / -1" }}>
                          <label className="form-label">Dashboard Profile (determines which features &amp; data the viewer sees)</label>
                          <select className="form-input form-select" value={editUserForm.dashboard_profile} onChange={(e) => setEditUserForm({ ...editUserForm, dashboard_profile: e.target.value })}>
                            {PROFILES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                          </select>
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: "0.75rem", marginTop: "1.25rem" }}>
                        <button type="submit" className="btn btn-primary" disabled={submitting}>{submitting ? "Saving…" : "Save Changes"}</button>
                        <button type="button" className="btn btn-secondary" onClick={() => setEditUserId(null)}>Cancel</button>
                      </div>
                    </form>
                  </div>
                </div>
              </div>
            )}

            <div className="panel">
              <div className="panel-header"><span className="panel-title">All Portal Users ({users.length})</span></div>
              {usersLoading ? (
                <div className="panel-body" style={{ textAlign: "center", color: "var(--ink-4)", fontSize: "0.82rem" }}>Loading…</div>
              ) : (
                <div className="data-table-wrap" style={{ border: "none", borderRadius: 0 }}>
                  <table className="data-table">
                    <thead>
                      <tr><th>Full Name</th><th>Username</th><th>Agency</th><th>Portal</th><th>Dashboard Profile</th><th>Status</th><th>Actions</th></tr>
                    </thead>
                    <tbody>
                      {users.map((u) => (
                        <tr key={u.id}>
                          <td className="td-primary">{u.full_name}<div style={{ fontSize: "0.68rem", color: "var(--ink-5)", fontFamily: "var(--font-mono)" }}>{u.email}</div></td>
                          <td className="td-mono" style={{ fontSize: "0.75rem" }}>{u.username}</td>
                          <td style={{ fontSize: "0.78rem" }}>{u.agency || "—"}</td>
                          <td>
                            <span className={`tag ${u.role === "admin" ? "tag-ink" : u.role === "viewer" ? "tag-muted" : "tag-green"}`}>
                              {u.role === "admin" ? "Admin" : u.role === "viewer" ? "Viewer" : "Staff"}
                            </span>
                          </td>
                          <td style={{ fontSize: "0.72rem", color: "var(--ink-4)" }}>{u.dashboard_profile ?? "—"}</td>
                          <td>{u.is_active ? <span className="tag tag-green"><span className="live-dot" style={{ marginRight: 4 }} />Active</span> : <span className="tag tag-red">Deactivated</span>}</td>
                          <td>
                            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                              <button className="btn btn-secondary btn-sm" onClick={() => startEditUser(u)} style={{ fontSize: "0.72rem", padding: "3px 8px" }}>Edit Profile</button>
                              <button className="btn btn-secondary btn-sm" onClick={() => setResetId(u.id)} style={{ fontSize: "0.72rem", padding: "3px 8px" }}>Reset Pwd</button>
                              <button className={`btn btn-sm ${u.is_active ? "btn-secondary" : "btn-primary"}`} onClick={() => toggleUser(u.id)} style={{ fontSize: "0.72rem", padding: "3px 8px" }}>
                                {u.is_active ? "Deactivate" : "Activate"}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}

        {/* ── DATA ENTRY TAB ── */}
        {tab === "entry" && (
          <>
            <div style={{ marginBottom: "1.5rem" }}>
              <h1 style={{ fontFamily: "var(--font-serif)", fontSize: "1.5rem", fontWeight: 400, color: "var(--ink)", marginBottom: "0.25rem" }}>Manual Data Entry</h1>
              <p style={{ fontSize: "0.8rem", color: "var(--ink-4)" }}>
                Enter energy records directly until IoT/automated feeds are ready. Each submission creates an audited upload record.
              </p>
            </div>

            {entryMsg && (
              <div style={{ marginBottom: "1.5rem", padding: "0.875rem 1rem", background: entryMsg.type === "ok" ? "var(--green-strong)" : "var(--red-tint)", border: `1px solid ${entryMsg.type === "ok" ? "var(--green-line)" : "rgba(192,57,43,0.2)"}`, borderRadius: "var(--r-md)", fontSize: "0.82rem", color: entryMsg.type === "ok" ? "var(--green-deep)" : "var(--red)" }}>
                {entryMsg.text}
              </div>
            )}

            <div className="panel">
              <div className="panel-header"><span className="panel-title">New Record</span></div>
              <div className="panel-body">
                <form onSubmit={doManualEntry}>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1rem 1.5rem" }}>

                    {/* Series type → unit auto-fills */}
                    <div className="form-group" style={{ marginBottom: 0, gridColumn: "1 / -1" }}>
                      <label className="form-label">Energy Series / Data Type</label>
                      <select className="form-input form-select" value={entryForm.series_type_id}
                        onChange={(e) => {
                          const meta = SERIES_META[e.target.value];
                          const defaultPeriod = buildPeriodOptions(meta?.freq ?? "monthly", entryForm.year)[0] ?? "";
                          setEntryForm((f) => ({ ...f, series_type_id: e.target.value, period: defaultPeriod }));
                        }}>
                        {Object.entries(SERIES_META).map(([id, m]) => (
                          <option key={id} value={id}>{m.name} — {m.unit} ({m.freq})</option>
                        ))}
                      </select>
                      <div style={{ fontSize: "0.72rem", color: "var(--green-deep)", fontWeight: 600, marginTop: 4 }}>
                        Unit: <strong>{SERIES_META[entryForm.series_type_id]?.unit}</strong>
                        {SERIES_META[entryForm.series_type_id]?.fuel_product && <> · Product: <strong>{SERIES_META[entryForm.series_type_id]?.fuel_product}</strong></>}
                      </div>
                    </div>

                    {/* Year → rebuilds period options */}
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Year</label>
                      <select className="form-input form-select" value={entryForm.year}
                        onChange={(e) => {
                          const yr = parseInt(e.target.value);
                          const meta = SERIES_META[entryForm.series_type_id];
                          const defaultPeriod = buildPeriodOptions(meta?.freq ?? "monthly", yr)[0] ?? "";
                          setEntryForm((f) => ({ ...f, year: yr, period: defaultPeriod }));
                        }}>
                        {ENTRY_YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
                      </select>
                    </div>

                    {/* Period — dynamic based on freq */}
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Period</label>
                      <select className="form-input form-select" value={entryForm.period}
                        onChange={(e) => setEntryForm((f) => ({ ...f, period: e.target.value }))}>
                        {buildPeriodOptions(SERIES_META[entryForm.series_type_id]?.freq ?? "monthly", entryForm.year).map((p) => (
                          <option key={p} value={p}>{p}</option>
                        ))}
                      </select>
                    </div>

                    {/* Value */}
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Value ({SERIES_META[entryForm.series_type_id]?.unit})</label>
                      <input className="form-input" type="number" step="any" placeholder="e.g. 85.4" required
                        value={entryForm.value} onChange={(e) => setEntryForm((f) => ({ ...f, value: e.target.value }))} />
                    </div>

                    {/* State — auto fills region */}
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">State</label>
                      <select className="form-input form-select" value={entryForm.state}
                        onChange={(e) => {
                          const st = e.target.value;
                          const zone = STATE_TO_ZONE[st] ?? "";
                          setEntryForm((f) => ({ ...f, state: st, region: zone }));
                        }}>
                        <option value="NGA">National (NGA)</option>
                        {ALL_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>

                    {/* Region — auto-filled from state, or manual override */}
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Geopolitical Zone</label>
                      <select className="form-input form-select" value={entryForm.region}
                        onChange={(e) => setEntryForm((f) => ({ ...f, region: e.target.value }))}>
                        <option value="">National</option>
                        {Object.keys(NG_ZONES).map((z) => <option key={z} value={z}>{z}</option>)}
                      </select>
                      {entryForm.state !== "NGA" && entryForm.region && (
                        <div style={{ fontSize: "0.68rem", color: "var(--ink-5)", marginTop: 3 }}>Auto-filled from state</div>
                      )}
                    </div>

                    {/* Source */}
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Source Attribution</label>
                      <input className="form-input" placeholder="NUPRC, NERC, NBS…"
                        value={entryForm.source} onChange={(e) => setEntryForm((f) => ({ ...f, source: e.target.value }))} />
                    </div>

                    {/* Notes */}
                    <div className="form-group" style={{ marginBottom: 0, gridColumn: "2 / -1" }}>
                      <label className="form-label">Notes (optional)</label>
                      <input className="form-input" placeholder="Preliminary estimate, provisional, revised…"
                        value={entryForm.notes} onChange={(e) => setEntryForm((f) => ({ ...f, notes: e.target.value }))} />
                    </div>

                  </div>

                  {/* Summary line */}
                  {entryForm.value && entryForm.period && (
                    <div style={{ marginTop: "1rem", padding: "0.75rem 1rem", background: "var(--green-strong)", border: "1px solid var(--green-line)", borderRadius: "var(--r-md)", fontSize: "0.8rem", color: "var(--green-deep)" }}>
                      Will commit: <strong>{SERIES_META[entryForm.series_type_id]?.name}</strong> · {entryForm.period} · <strong>{entryForm.value} {SERIES_META[entryForm.series_type_id]?.unit}</strong>
                      {entryForm.state !== "NGA" ? ` · ${entryForm.state}` : " · National"}
                      {entryForm.source ? ` · Source: ${entryForm.source}` : ""}
                    </div>
                  )}

                  <div style={{ marginTop: "1.25rem", display: "flex", gap: "0.75rem" }}>
                    <button type="submit" className="btn btn-primary" disabled={entrySubmitting}>
                      {entrySubmitting ? "Committing…" : "Commit Record"}
                    </button>
                    <button type="button" className="btn btn-secondary" onClick={() => { setEntryForm(ENTRY_INIT); setEntryMsg(null); }}>Reset Form</button>
                  </div>
                  <p style={{ fontSize: "0.72rem", color: "var(--ink-5)", marginTop: "0.75rem" }}>
                    Each submission is logged as a manual upload session with your admin account as the attributed source.
                  </p>
                </form>
              </div>
            </div>
          </>
        )}

        {/* ── IOT / API TAB ── */}
        {tab === "iot" && (
          <>
            <div style={{ marginBottom: "1.5rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: "0.25rem" }}>
                <h1 style={{ fontFamily: "var(--font-serif)", fontSize: "1.5rem", fontWeight: 400, color: "var(--ink)", margin: 0 }}>IoT & EOM Telemetry Integration</h1>
                <span className="tag tag-amber" style={{ fontSize: "0.65rem" }}>Device Management — Coming Soon</span>
              </div>
              <p style={{ fontSize: "0.8rem", color: "var(--ink-4)" }}>
                Energy Operation Management (EOM) systems and IoT field devices post readings directly to this API. Data lands in real-time on the Data Point dashboard.
              </p>
            </div>

            {/* Ingest endpoint card */}
            <div className="panel" style={{ marginBottom: "1.5rem" }}>
              <div className="panel-header"><span className="panel-title">Ingest Endpoint</span><span className="tag tag-green"><span className="live-dot" style={{ marginRight: 4 }} />Active</span></div>
              <div className="panel-body" style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>

                <div>
                  <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>POST Endpoint</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <code style={{ flex: 1, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 6, padding: "10px 14px", fontSize: "0.82rem", fontFamily: "var(--font-mono)", color: "var(--ink)" }}>
                      https://nedb.vercel.app/api/iot/ingest
                    </code>
                    <button onClick={() => copyToClipboard("https://nedb.vercel.app/api/iot/ingest", "url")} style={{ padding: "8px 14px", border: "1px solid var(--border)", borderRadius: 6, background: copied === "url" ? "var(--green)" : "var(--surface)", color: copied === "url" ? "#fff" : "var(--ink-4)", fontSize: "0.75rem", cursor: "pointer", whiteSpace: "nowrap", transition: "0.15s" }}>
                      {copied === "url" ? "Copied!" : "Copy"}
                    </button>
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>API Key — share with device operators only</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <code style={{ flex: 1, background: "var(--ink)", border: "1px solid var(--border)", borderRadius: 6, padding: "10px 14px", fontSize: "0.78rem", fontFamily: "var(--font-mono)", color: "var(--green)", letterSpacing: "0.04em" }}>
                      Add <strong style={{ color: "#fff" }}>IOT_API_KEY</strong> to your Vercel environment variables
                    </code>
                    <button onClick={() => copyToClipboard("X-API-Key", "key")} style={{ padding: "8px 14px", border: "1px solid var(--border)", borderRadius: 6, background: "var(--surface)", color: "var(--ink-4)", fontSize: "0.75rem", cursor: "pointer", whiteSpace: "nowrap" }}>
                      Copy Header
                    </button>
                  </div>
                  <p style={{ fontSize: "0.7rem", color: "var(--amber)", marginTop: 6 }}>Set IOT_API_KEY in Vercel → Settings → Environment Variables. Never expose this in client code.</p>
                </div>

                <div>
                  <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Authentication Header</div>
                  <code style={{ display: "block", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 6, padding: "10px 14px", fontSize: "0.78rem", fontFamily: "var(--font-mono)", color: "var(--ink)" }}>
                    X-API-Key: {"<your-iot-api-key>"}
                  </code>
                </div>
              </div>
            </div>

            {/* Payload examples */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.25rem", marginBottom: "1.5rem" }}>
              <div className="panel">
                <div className="panel-header"><span className="panel-title">Single Reading</span><span style={{ fontSize: "0.68rem", color: "var(--ink-5)" }}>e.g. one monthly figure</span></div>
                <div className="panel-body">
                  <pre style={{ margin: 0, fontSize: "0.72rem", fontFamily: "var(--font-mono)", color: "var(--ink-3)", background: "var(--surface)", borderRadius: 6, padding: "1rem", overflowX: "auto", lineHeight: 1.6 }}>{`POST /api/iot/ingest
X-API-Key: <key>
Content-Type: application/json

{
  "series_type_id": "crude_oil_production",
  "period":         "2026-06",
  "period_date":    "2026-06-01",
  "value":          85.4,
  "unit":           "M Barrels",
  "region":         "NGA",
  "source":         "NUPRC Field Station",
  "device_id":      "EOM-OML23-001"
}`}</pre>
                </div>
              </div>

              <div className="panel">
                <div className="panel-header"><span className="panel-title">Batch Reading</span><span style={{ fontSize: "0.68rem", color: "var(--ink-5)" }}>up to 100 rows per call</span></div>
                <div className="panel-body">
                  <pre style={{ margin: 0, fontSize: "0.72rem", fontFamily: "var(--font-mono)", color: "var(--ink-3)", background: "var(--surface)", borderRadius: 6, padding: "1rem", overflowX: "auto", lineHeight: 1.6 }}>{`POST /api/iot/ingest
X-API-Key: <key>
Content-Type: application/json

{
  "series_type_id": "electricity_generation",
  "readings": [
    {
      "period":      "2026-01",
      "period_date": "2026-01-01",
      "value":       2810.3,
      "region":      "NGA"
    },
    {
      "period":      "2026-02",
      "period_date": "2026-02-01",
      "value":       2790.1
    }
  ]
}`}</pre>
                </div>
              </div>
            </div>

            {/* Supported series */}
            <div className="panel" style={{ marginBottom: "1.5rem" }}>
              <div className="panel-header"><span className="panel-title">Supported Series Types</span></div>
              <div className="data-table-wrap" style={{ border: "none", borderRadius: 0 }}>
                <table className="data-table">
                  <thead><tr><th>series_type_id</th><th>Series Name</th><th>Default Unit</th><th>Frequency</th></tr></thead>
                  <tbody>
                    {Object.entries(SERIES_META).map(([id, m]) => (
                      <tr key={id}>
                        <td className="td-mono" style={{ fontSize: "0.72rem", color: "var(--green)" }}>{id}</td>
                        <td className="td-primary">{m.name}</td>
                        <td style={{ fontSize: "0.78rem", fontFamily: "var(--font-mono)" }}>{m.unit}</td>
                        <td><span className="tag tag-muted" style={{ fontSize: "0.62rem" }}>{m.freq}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Device management — coming soon */}
            <div className="panel">
              <div className="panel-header"><span className="panel-title">Registered Devices</span><span className="tag tag-amber">Coming Soon</span></div>
              <div className="panel-body" style={{ textAlign: "center", padding: "2.5rem", color: "var(--ink-5)" }}>
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" style={{ opacity: 0.25, marginBottom: "1rem" }}><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/><line x1="12" y1="12" x2="12" y2="16"/><line x1="10" y1="14" x2="14" y2="14"/></svg>
                <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--ink-4)", marginBottom: 6 }}>Device Registry Coming Soon</div>
                <div style={{ fontSize: "0.78rem", maxWidth: 400, margin: "0 auto" }}>
                  Register EOM devices by name, assign series types, view last-seen timestamps, and rotate API keys per device. The ingest endpoint is live and ready — devices can post data now using the key above.
                </div>
              </div>
            </div>
          </>
        )}

        {/* ── REGISTRY TAB ── */}
        {tab === "registry" && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.5rem", flexWrap: "wrap", gap: "1rem" }}>
              <div>
                <h1 style={{ fontFamily: "var(--font-serif)", fontSize: "1.5rem", fontWeight: 400, color: "var(--ink)", marginBottom: "0.25rem" }}>Producing Companies Registry</h1>
                <p style={{ fontSize: "0.8rem", color: "var(--ink-4)" }}>
                  Reference registry of licensed upstream and midstream producers. Visible on the Revenue Portal dashboard and public data bank.
                </p>
              </div>
              <button className="btn btn-primary" onClick={() => { setShowCoForm(!showCoForm); setEditId(null); setCoForm(EMPTY_CO); setMsg(null); }}>
                {showCoForm && !editId ? "Cancel" : "Add Company"}
              </button>
            </div>

            {showCoForm && (
              <div className="panel" style={{ marginBottom: "1.5rem" }}>
                <div className="panel-header"><span className="panel-title">{editId ? "Edit Company" : "Add Company to Registry"}</span></div>
                <div className="panel-body">
                  <form onSubmit={saveCompany}>
                    <div className="admin-form-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem 1.5rem" }}>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Company Name</label>
                        <input className="form-input" placeholder="e.g. Seplat Energy" required value={coForm.company} onChange={(e) => setCoForm({ ...coForm, company: e.target.value })} />
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">OML Block(s)</label>
                        <input className="form-input" placeholder="e.g. OML 4, 38, 41" value={coForm.oml_blocks} onChange={(e) => setCoForm({ ...coForm, oml_blocks: e.target.value })} />
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Operator Type</label>
                        <select className="form-input form-select" value={coForm.operator_type} onChange={(e) => setCoForm({ ...coForm, operator_type: e.target.value })}>
                          <option value="National">National</option>
                          <option value="IOC JV">IOC JV</option>
                          <option value="Indigenous">Indigenous</option>
                          <option value="PSC">PSC</option>
                          <option value="Marginal Field">Marginal Field</option>
                        </select>
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Sector</label>
                        <select className="form-input form-select" value={coForm.sector} onChange={(e) => setCoForm({ ...coForm, sector: e.target.value })}>
                          <option value="Upstream">Upstream</option>
                          <option value="Midstream">Midstream</option>
                          <option value="Downstream">Downstream</option>
                          <option value="Gas">Gas</option>
                        </select>
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Status</label>
                        <select className="form-input form-select" value={coForm.status} onChange={(e) => setCoForm({ ...coForm, status: e.target.value })}>
                          <option value="Active">Active</option>
                          <option value="Suspended">Suspended</option>
                          <option value="Revoked">Revoked</option>
                          <option value="Dormant">Dormant</option>
                        </select>
                      </div>
                    </div>
                    <div style={{ marginTop: "1.25rem", display: "flex", gap: "0.75rem" }}>
                      <button type="submit" className="btn btn-primary" disabled={submitting}>{submitting ? "Saving…" : editId ? "Update Company" : "Add to Registry"}</button>
                      <button type="button" className="btn btn-secondary" onClick={() => { setShowCoForm(false); setEditId(null); setCoForm(EMPTY_CO); }}>Cancel</button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            <div className="panel">
              <div className="panel-header"><span className="panel-title">Registry ({companies.length} companies)</span></div>
              {regLoading ? (
                <div className="panel-body" style={{ textAlign: "center", color: "var(--ink-4)", fontSize: "0.82rem" }}>Loading…</div>
              ) : (
                <div className="data-table-wrap" style={{ border: "none", borderRadius: 0 }}>
                  <table className="data-table">
                    <thead>
                      <tr><th>Company</th><th>OML Block(s)</th><th>Operator Type</th><th>Sector</th><th>Status</th><th>Actions</th></tr>
                    </thead>
                    <tbody>
                      {companies.map((c) => (
                        <tr key={c.id}>
                          <td className="td-primary">{c.company}</td>
                          <td style={{ fontFamily: "var(--font-mono)", fontSize: "0.72rem", color: "var(--ink-3)" }}>{c.oml_blocks ?? "—"}</td>
                          <td style={{ fontSize: "0.78rem" }}>{c.operator_type}</td>
                          <td><span className="tag tag-green" style={{ fontSize: "0.62rem" }}>{c.sector}</span></td>
                          <td>
                            <span className={`tag ${c.status === "Active" ? "tag-green" : c.status === "Suspended" ? "tag-amber" : "tag-red"}`}>
                              {c.status === "Active" && <span className="live-dot" style={{ marginRight: 4 }} />}
                              {c.status}
                            </span>
                          </td>
                          <td>
                            <div style={{ display: "flex", gap: 6 }}>
                              <button className="btn btn-secondary btn-sm" onClick={() => startEditCompany(c)} style={{ fontSize: "0.72rem", padding: "3px 8px" }}>Edit</button>
                              <button className="btn btn-sm" onClick={() => deleteCompany(c.id, c.company)} style={{ fontSize: "0.72rem", padding: "3px 8px", background: "var(--red-tint)", color: "var(--red)", border: "1px solid rgba(192,57,43,0.2)" }}>Delete</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}

        {/* ── ACCESS REQUESTS TAB ── */}
        {tab === "requests" && (
          <>
            {/* Filter bar */}
            <div style={{ display: "flex", gap: 8, marginBottom: "1.5rem", alignItems: "center" }}>
              <span style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--ink-4)" }}>Show:</span>
              {["pending","approved","rejected","all"].map((s) => (
                <button key={s} onClick={() => loadRequests(s)} style={{ padding: "4px 12px", fontSize: "0.72rem", fontWeight: 700, border: "1px solid var(--border)", borderRadius: 4, background: "transparent", color: "var(--ink-4)", cursor: "pointer", textTransform: "capitalize" }}>{s}</button>
              ))}
              <span style={{ marginLeft: "auto", fontSize: "0.72rem", color: "var(--ink-5)" }}>{requests.length} result{requests.length !== 1 ? "s" : ""}</span>
            </div>

            {/* Approved user flash */}
            {approvedUser && (
              <div style={{ marginBottom: "1.5rem", padding: "1rem 1.25rem", background: "var(--green-strong)", border: "1px solid var(--green-line)", borderRadius: "var(--r-md)" }}>
                <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--green-deep)" }}>Account created successfully</div>
                <div style={{ fontSize: "0.82rem", color: "var(--green-deep)", marginTop: 4 }}>
                  Username: <strong style={{ fontFamily: "var(--font-mono)" }}>{approvedUser}</strong> &nbsp;·&nbsp; Share the username + password with the user securely.
                </div>
                <button onClick={() => setApprovedUser(null)} style={{ marginTop: 8, fontSize: "0.72rem", color: "var(--green-deep)", background: "transparent", border: "none", cursor: "pointer", textDecoration: "underline" }}>Dismiss</button>
              </div>
            )}

            {/* Approve modal */}
            {approveId !== null && (
              <div style={{ marginBottom: "1.5rem", padding: "1.25rem", background: "#fff", border: "1px solid var(--border)", borderRadius: "var(--r-lg)", boxShadow: "var(--shadow-2)" }}>
                <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--ink)", marginBottom: "0.5rem" }}>Set Initial Password</div>
                <div style={{ fontSize: "0.78rem", color: "var(--ink-4)", marginBottom: "1rem" }}>An account will be created for this user. Set a temporary password to share with them securely.</div>
                <div style={{ display: "flex", gap: 8 }}>
                  <input type="password" value={approvePwd} onChange={(e) => setApprovePwd(e.target.value)} placeholder="Min. 6 characters" style={{ flex: 1, padding: "8px 12px", fontSize: "0.82rem", border: "1px solid var(--border)", borderRadius: 6, background: "var(--surface)", color: "var(--ink)" }} />
                  <button onClick={approveRequest} disabled={submitting || approvePwd.length < 6} style={{ padding: "8px 18px", background: "var(--green)", color: "#fff", border: "none", borderRadius: 6, fontSize: "0.82rem", fontWeight: 700, cursor: approvePwd.length >= 6 ? "pointer" : "not-allowed", opacity: approvePwd.length >= 6 ? 1 : 0.5 }}>Create Account</button>
                  <button onClick={() => { setApproveId(null); setApprovePwd(""); }} style={{ padding: "8px 14px", background: "transparent", border: "1px solid var(--border)", borderRadius: 6, fontSize: "0.82rem", cursor: "pointer" }}>Cancel</button>
                </div>
              </div>
            )}

            {reqLoading ? (
              <div style={{ textAlign: "center", padding: "3rem", color: "var(--ink-5)" }}>Loading requests…</div>
            ) : requests.length === 0 ? (
              <div style={{ textAlign: "center", padding: "3rem", color: "var(--ink-5)" }}>No access requests found.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                {requests.map((req) => (
                  <div key={req.id} style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: "var(--r-lg)", padding: "1.25rem", borderLeft: `4px solid ${req.status === "pending" ? "var(--amber)" : req.status === "approved" ? "var(--green)" : "#aaa"}` }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "0.75rem" }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                          <span style={{ fontSize: "0.92rem", fontWeight: 700, color: "var(--ink)" }}>{req.full_name}</span>
                          <span style={{ fontSize: "0.7rem", color: "var(--ink-5)", fontFamily: "var(--font-mono)" }}>{req.email}</span>
                          <span className={`tag ${req.status === "pending" ? "tag-amber" : req.status === "approved" ? "tag-green" : ""}`} style={{ fontSize: "0.62rem" }}>{req.status.toUpperCase()}</span>
                        </div>
                        <div style={{ fontSize: "0.78rem", color: "var(--ink-4)", marginTop: 4 }}>{req.organisation}{req.position ? ` · ${req.position}` : ""}</div>
                        <div style={{ marginTop: 6, display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <span style={{ fontSize: "0.68rem", fontWeight: 700, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 4, padding: "2px 8px", color: "var(--ink-4)" }}>Profile: {req.profile_key}</span>
                          {req.temp_username && <span style={{ fontSize: "0.68rem", fontFamily: "var(--font-mono)", background: "var(--green-strong)", border: "1px solid var(--green-line)", borderRadius: 4, padding: "2px 8px", color: "var(--green-deep)" }}>User: {req.temp_username}</span>}
                        </div>
                        {req.justification && (
                          <div style={{ marginTop: 8, fontSize: "0.78rem", color: "var(--ink-4)", background: "var(--surface)", borderRadius: 4, padding: "6px 10px", borderLeft: "2px solid var(--border)", lineHeight: 1.5 }}>{req.justification}</div>
                        )}
                        <div style={{ marginTop: 6, fontSize: "0.65rem", color: "var(--ink-5)" }}>Submitted {new Date(req.created_at).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</div>
                      </div>
                      {req.status === "pending" && (
                        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                          <button onClick={() => { setApproveId(req.id); setApprovePwd(""); setApprovedUser(null); }} style={{ padding: "6px 14px", background: "var(--green)", color: "#fff", border: "none", borderRadius: 6, fontSize: "0.78rem", fontWeight: 700, cursor: "pointer" }}>Approve →</button>
                          <button onClick={() => rejectRequest(req.id)} style={{ padding: "6px 12px", background: "transparent", color: "var(--red)", border: "1px solid rgba(192,57,43,0.3)", borderRadius: 6, fontSize: "0.78rem", cursor: "pointer" }}>Reject</button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
