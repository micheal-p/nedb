"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { saveTokens, isLoggedIn, getRole } from "@/lib/auth";
import CoatOfArms from "@/components/layout/CoatOfArms";

function defaultRedirect(role: string): string {
  if (role === "admin") return "/data-point/admin";
  if (role === "staff") return "/upload";
  return "/data-point/dashboard"; // viewer
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const explicitRedirect = searchParams.get("redirect");

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isLoggedIn()) router.replace(explicitRedirect ?? defaultRedirect(getRole()));
  }, [router, explicitRedirect]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!username || !password) { setError("Username and password are required."); return; }
    setLoading(true);
    setError("");
    try {
      const result = await api.login(username, password);
      saveTokens(result.token, result.refresh_token, result.full_name, result.role);
      router.push(explicitRedirect ?? defaultRedirect(result.role));
    } catch {
      setError("Invalid credentials. Contact the NEDB administrator if you need access.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-wrap">
      <div className="login-panel">
        <div style={{ maxWidth: 380, width: "100%" }}>
          <div style={{ marginBottom: "2.5rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: "0.5rem" }}>
              <CoatOfArms size={42} />
              <div>
                <div style={{ fontSize: "0.95rem", fontWeight: 700, color: "var(--ink)" }}>NEDB</div>
                <div style={{ fontSize: "0.62rem", color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: "0.08em" }}>National Energy Data Bank</div>
              </div>
            </div>
          </div>

          <h1 style={{ fontFamily: "var(--font-serif)", fontSize: "1.625rem", fontWeight: 400, color: "var(--ink)", marginBottom: "0.375rem", lineHeight: 1.15 }}>
            NEDB Portal Login
          </h1>
          <p style={{ fontSize: "0.8rem", color: "var(--ink-4)", marginBottom: "2rem", lineHeight: 1.6 }}>
            Access restricted to authorised ECN and agency personnel. Energy Staff are redirected to the
            Upload Portal. Data Point Viewers are redirected to the Intelligence Dashboard.
          </p>

          {error && (
            <div style={{ marginBottom: "1.25rem", padding: "0.75rem 1rem", background: "var(--red-tint)", border: "1px solid rgba(192,57,43,0.2)", borderRadius: "var(--r-md)", fontSize: "0.82rem", color: "var(--red)" }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Username</label>
              <input
                className="form-input"
                type="text"
                placeholder="ECN staff username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Password</label>
              <input
                className="form-input"
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
              style={{ width: "100%", justifyContent: "center", padding: "0.7rem 1.5rem", fontSize: "0.875rem", marginTop: "0.5rem" }}
            >
              {loading ? "Authenticating..." : "Sign In"}
            </button>
          </form>

          <div style={{ marginTop: "2rem", padding: "1rem", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--r-md)", fontSize: "0.75rem", color: "var(--ink-4)", lineHeight: 1.6 }}>
            Do not share your credentials. Sessions expire after 15 minutes of inactivity.
            Report suspicious activity to the ECN IT helpdesk.
          </div>

          <div style={{ marginTop: "1.5rem", textAlign: "center" }}>
            <Link href="/" style={{ fontSize: "0.78rem", color: "var(--ink-4)" }}>
              Return to public Data Bank
            </Link>
          </div>
        </div>
      </div>

      <div className="login-info">
        <div style={{ maxWidth: 420 }}>
          <h2>
            NEDB Intelligence Suite &mdash;<br />
            <em>energy data for those who decide.</em>
          </h2>
          <div className="info-points">
            {[
              {
                title: "Fiscal Intelligence Panels",
                desc: "Real-time energy revenue, midstream throughput, and power sector settlement data mapped to agency reports.",
              },
              {
                title: "Validated Data Upload",
                desc: "Upload CSV or XLSX datasets with row-by-row validation, error previews and atomic commit to the central database.",
              },
              {
                title: "Anomaly Detection Feed",
                desc: "Automated alerts for statistical anomalies, sudden value changes, and data gaps across all monitored series.",
              },
              {
                title: "Restricted Access",
                desc: "Intelligence Suite access is limited to ECN staff and designated agency liaisons. Public data remains freely accessible.",
              },
            ].map((pt) => (
              <div key={pt.title} className="info-point">
                <div className="pt-icon">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9 12l2 2 4-4M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <div className="pt-text">
                  <h4>{pt.title}</h4>
                  <p>{pt.desc}</p>
                </div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: "2.5rem", paddingTop: "2rem", borderTop: "1px solid rgba(255,255,255,0.1)", fontSize: "0.72rem", color: "rgba(255,255,255,0.3)" }}>
            Energy Commission of Nigeria (ECN) &nbsp;·&nbsp; National Energy Data Bank (NEDB)<br />
            Established under ECN Act, CAP. E10, LFN 2004
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", background: "var(--ink)" }} />}>
      <LoginForm />
    </Suspense>
  );
}
