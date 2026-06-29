"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { api, type StaffUser } from "@/lib/api";
import { getToken, getRole, getFullName } from "@/lib/auth";
import CoatOfArms from "@/components/layout/CoatOfArms";

export default function AdminPage() {
  const router = useRouter();
  const [users, setUsers] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [resetId, setResetId] = useState<number | null>(null);
  const [newPwd, setNewPwd] = useState("");

  const [form, setForm] = useState({
    username: "", full_name: "", email: "",
    role: "staff", agency: "", password: "",
  });

  const load = useCallback(async () => {
    const token = getToken();
    if (!token) { router.replace("/data-point/login?redirect=/data-point/admin"); return; }
    if (getRole() !== "admin") { router.replace("/data-point/dashboard"); return; }
    try {
      const data = await api.listStaff(token);
      setUsers(data);
    } catch { /* ignore */ }
    setLoading(false);
  }, [router]);

  useEffect(() => { load(); }, [load]);

  async function createUser(e: React.FormEvent) {
    e.preventDefault();
    const token = getToken();
    if (!token) return;
    setSubmitting(true);
    setMsg(null);
    try {
      await api.createStaff(form, token);
      setMsg({ type: "ok", text: `Account created for ${form.full_name} (${form.username}).` });
      setForm({ username: "", full_name: "", email: "", role: "staff", agency: "", password: "" });
      setShowForm(false);
      load();
    } catch (err) {
      setMsg({ type: "err", text: err instanceof Error ? err.message : "Failed to create account." });
    } finally {
      setSubmitting(false);
    }
  }

  async function toggle(id: number) {
    const token = getToken();
    if (!token) return;
    await api.toggleStaff(id, token);
    load();
  }

  async function doResetPassword() {
    if (!resetId || !newPwd) return;
    const token = getToken();
    if (!token) return;
    await api.resetPassword(resetId, newPwd, token);
    setMsg({ type: "ok", text: "Password reset successfully." });
    setResetId(null);
    setNewPwd("");
  }

  const adminName = getFullName() || "Administrator";

  return (
    <div style={{ minHeight: "100vh", background: "var(--surface)" }}>
      {/* Header */}
      <div style={{ background: "var(--ink)", borderBottom: "3px solid var(--green)", padding: "0 2rem" }}>
        <div style={{ maxWidth: "var(--max-w)", margin: "0 auto", height: 60, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <CoatOfArms size={36} />
            <div>
              <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "#fff" }}>NEDB Admin</div>
              <div style={{ fontSize: "0.62rem", color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Energy Staff Management</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <span style={{ fontSize: "0.78rem", color: "rgba(255,255,255,0.5)" }}>Signed in as {adminName}</span>
            <button onClick={() => router.push("/data-point/dashboard")} className="btn btn-ghost btn-sm">Dashboard</button>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: "var(--max-w)", margin: "0 auto", padding: "2.5rem 2rem" }}>

        {/* Page title + actions */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "2rem", flexWrap: "wrap", gap: "1rem" }}>
          <div>
            <h1 style={{ fontFamily: "var(--font-serif)", fontSize: "1.625rem", fontWeight: 400, color: "var(--ink)", marginBottom: "0.25rem" }}>
              User Accounts
            </h1>
            <p style={{ fontSize: "0.8rem", color: "var(--ink-4)" }}>
              Manage all NEDB portal users. <strong>Energy Staff</strong> can upload datasets. <strong>Data Point Viewers</strong> access the Intelligence Dashboard. All uploads are attributed to the staff member by name.
            </p>
          </div>
          <button className="btn btn-primary" onClick={() => { setShowForm(!showForm); setMsg(null); }}>
            {showForm ? "Cancel" : "Create Account"}
          </button>
        </div>

        {msg && (
          <div style={{ marginBottom: "1.5rem", padding: "0.875rem 1rem", background: msg.type === "ok" ? "var(--green-strong)" : "var(--red-tint)", border: `1px solid ${msg.type === "ok" ? "var(--green-line)" : "rgba(192,57,43,0.2)"}`, borderRadius: "var(--r-md)", fontSize: "0.82rem", color: msg.type === "ok" ? "var(--green-deep)" : "var(--red)" }}>
            {msg.text}
          </div>
        )}

        {/* Create form */}
        {showForm && (
          <div className="panel" style={{ marginBottom: "2rem" }}>
            <div className="panel-header"><span className="panel-title">Create New Account</span></div>
            <div className="panel-body">
              <form onSubmit={createUser}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem 1.5rem" }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Full Name</label>
                    <input className="form-input" placeholder="e.g. Adeola Okafor" required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Username</label>
                    <input className="form-input" placeholder="e.g. aokafor" required value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value.toLowerCase().replace(/\s/g, "") })} />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Email Address</label>
                    <input className="form-input" type="email" placeholder="staff@ecnnigeria.org" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Agency</label>
                    <input className="form-input" placeholder="e.g. ECN, NUPRC, NERC" value={form.agency} onChange={(e) => setForm({ ...form, agency: e.target.value })} />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Role</label>
                    <select className="form-input form-select" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                      <option value="staff">Energy Staff (upload only)</option>
                      <option value="viewer">Data Point Viewer (dashboard only)</option>
                      <option value="admin">Administrator (full access)</option>
                    </select>
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Temporary Password</label>
                    <input className="form-input" type="password" placeholder="Min. 8 characters" required minLength={8} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
                  </div>
                </div>
                <div style={{ marginTop: "1.25rem", display: "flex", gap: "0.75rem" }}>
                  <button type="submit" className="btn btn-primary" disabled={submitting}>
                    {submitting ? "Creating..." : "Create Account"}
                  </button>
                  <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
                </div>
                <p style={{ fontSize: "0.72rem", color: "var(--ink-4)", marginTop: "0.75rem" }}>
                  After login: Energy Staff are sent to the Upload Portal, Data Point Viewers to the Intelligence Dashboard. Every uploaded dataset is attributed to the staff member by name.
                </p>
              </form>
            </div>
          </div>
        )}

        {/* Password reset modal */}
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

        {/* Staff table */}
        <div className="panel">
          <div className="panel-header">
            <span className="panel-title">All Portal Users ({users.length})</span>
          </div>
          {loading ? (
            <div className="panel-body" style={{ textAlign: "center", color: "var(--ink-4)", fontSize: "0.82rem" }}>Loading...</div>
          ) : users.length === 0 ? (
            <div className="panel-body" style={{ textAlign: "center", color: "var(--ink-4)", fontSize: "0.82rem" }}>
              No staff accounts yet. Create the first one above.
            </div>
          ) : (
            <div className="data-table-wrap" style={{ border: "none", borderRadius: 0 }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Full Name</th>
                    <th>Username</th>
                    <th>Email</th>
                    <th>Agency</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Last Login</th>
                    <th>Created By</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id}>
                      <td className="td-primary">{u.full_name}</td>
                      <td className="td-mono">{u.username}</td>
                      <td style={{ fontSize: "0.78rem", color: "var(--ink-3)" }}>{u.email}</td>
                      <td style={{ fontSize: "0.78rem" }}>{u.agency || "—"}</td>
                      <td>
                        <span className={`tag ${u.role === "admin" ? "tag-ink" : u.role === "viewer" ? "tag-muted" : "tag-green"}`}>
                          {u.role === "admin" ? "Admin" : u.role === "viewer" ? "Viewer" : "Energy Staff"}
                        </span>
                      </td>
                      <td>
                        {u.is_active
                          ? <span className="tag tag-green"><span className="live-dot" style={{ marginRight: 4 }} />Active</span>
                          : <span className="tag tag-red">Deactivated</span>
                        }
                      </td>
                      <td style={{ fontSize: "0.75rem", color: "var(--ink-4)", fontFamily: "var(--font-mono)" }}>
                        {u.last_login ?? "Never"}
                      </td>
                      <td style={{ fontSize: "0.75rem", color: "var(--ink-4)" }}>{u.created_by || "system"}</td>
                      <td>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button className="btn btn-secondary btn-sm" onClick={() => setResetId(u.id)} style={{ fontSize: "0.72rem", padding: "3px 8px" }}>
                            Reset Pwd
                          </button>
                          <button
                            className={`btn btn-sm ${u.is_active ? "btn-secondary" : "btn-primary"}`}
                            onClick={() => toggle(u.id)}
                            style={{ fontSize: "0.72rem", padding: "3px 8px" }}
                          >
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

        <div style={{ marginTop: "1.5rem", padding: "1rem", background: "var(--green-strong)", border: "1px solid var(--green-line)", borderRadius: "var(--r-md)", fontSize: "0.78rem", color: "var(--ink-3)", lineHeight: 1.6 }}>
          <strong style={{ color: "var(--green-deep)" }}>Audit Trail:</strong> Every dataset uploaded by an Energy Staff member is permanently attributed to their full name in the database.
          The &ldquo;Uploaded by&rdquo; record appears on each series page and in the upload session log. Deactivating an account does not remove their historical attributions.
        </div>

      </div>
    </div>
  );
}
