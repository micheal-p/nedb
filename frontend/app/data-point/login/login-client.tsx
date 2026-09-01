"use client";

// ── Staff sign-in ───────────────────────────────────────────────────────────
// Fits the viewport rather than scrolling: the form sits in one column and the
// guidance that used to run down the page sits beside it on desktop, collapsing
// underneath on smaller screens. A visitor who landed here by accident can get
// back out from the top, and the statutory footer is present as on every other
// page of the service.

import { useState, useEffect, Suspense, type ReactNode } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { saveTokens, isLoggedIn, getRole } from "@/lib/auth";
import CoatOfArms from "@/components/layout/CoatOfArms";
import { ErrorSummary } from "@/components/ui/gov";

function defaultRedirect(role: string): string {
  if (role === "admin" || role === "superadmin") return "/admin";
  if (role === "staff" || role === "editor")     return "/upload";
  return "/data-point/dashboard"; // viewer
}

function LoginForm({ map }: { map?: ReactNode }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const explicitRedirect = searchParams.get("redirect");

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [capsOn, setCapsOn] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ anchor?: string; message: string }[]>([]);

  useEffect(() => {
    if (isLoggedIn()) router.replace(explicitRedirect ?? defaultRedirect(getRole()));
  }, [router, explicitRedirect]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const found: { anchor?: string; message: string }[] = [];
    if (!username.trim()) found.push({ anchor: "username", message: "Enter your username" });
    if (!password)        found.push({ anchor: "password", message: "Enter your password" });
    if (found.length) { setErrors(found); return; }

    setLoading(true);
    setErrors([]);
    try {
      const result = await api.login(username, password);
      saveTokens(result.token, result.refresh_token, result.full_name, result.role, result.dashboard_profile, result.admin_scope ?? null);
      router.push(explicitRedirect ?? defaultRedirect(result.role));
    } catch (e) {
      const msg = e instanceof Error && /too many/i.test(e.message)
        ? "Too many sign-in attempts from this connection. Wait a few minutes and try again."
        : "The username or password is not recognised.";
      setErrors([{ message: msg }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <div className="gov-banner">
        FEDERAL REPUBLIC OF NIGERIA &nbsp;&middot;&nbsp; ENERGY COMMISSION OF NIGERIA (ECN)
      </div>

      {/* Way out — a visitor who landed here by accident should never be stuck */}
      <div className="login-topbar">
        <Link href="/" className="login-back">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Back to the Data Bank
        </Link>
        <Link href="/portal" className="login-topbar-alt">Request access</Link>
      </div>

      <main className="login-main">
        <div className="login-grid">

          {/* Form */}
          <div className="login-col">
            <div className="login-brand">
              <CoatOfArms size={46} />
              <div>
                <div style={{ fontSize: "var(--t-base)", fontWeight: 700, color: "var(--ink)", lineHeight: 1.2 }}>National Energy Data Bank</div>
                <div className="eyebrow" style={{ marginTop: 1, marginBottom: 0 }}>Energy Commission of Nigeria</div>
              </div>
            </div>

            <ErrorSummary errors={errors} />

            <div className="login-card">
              <h1 style={{ fontSize: "var(--t-xl)", fontWeight: 700, color: "var(--ink)", marginBottom: "0.3rem", letterSpacing: "-0.01em" }}>Sign in</h1>
              <p style={{ fontSize: "var(--t-sm)", color: "var(--ink-3)", marginBottom: "1.25rem", lineHeight: 1.6 }}>
                For ECN staff and authorised agency personnel. You are taken to your own workspace automatically.
              </p>

              <form onSubmit={handleSubmit} noValidate>
                <div className="form-group">
                  <label className="form-label" htmlFor="username">Username</label>
                  <input
                    id="username" className="form-input" type="text"
                    value={username} onChange={(e) => setUsername(e.target.value)}
                    autoComplete="username" autoCapitalize="none" spellCheck={false} autoFocus
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="password">Password</label>
                  <div style={{ position: "relative" }}>
                    <input
                      id="password" className="form-input"
                      type={showPassword ? "text" : "password"}
                      value={password} onChange={(e) => setPassword(e.target.value)}
                      onKeyUp={(e) => setCapsOn(e.getModifierState?.("CapsLock") ?? false)}
                      autoComplete="current-password"
                      style={{ paddingRight: "4rem" }}
                    />
                    <button type="button" onClick={() => setShowPassword((v) => !v)} aria-pressed={showPassword}
                      style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", fontSize: "var(--t-xs)", fontWeight: 600, color: "var(--blue)", cursor: "pointer", textDecoration: "underline", textUnderlineOffset: 2 }}>
                      {showPassword ? "Hide" : "Show"}
                    </button>
                  </div>
                  {capsOn && (
                    <div style={{ fontSize: "var(--t-xs)", color: "var(--amber)", fontWeight: 600, marginTop: 4 }}>Caps Lock is on.</div>
                  )}
                </div>

                <button type="submit" className="btn btn-primary" disabled={loading}
                  style={{ width: "100%", marginTop: "0.35rem" }}>
                  {loading ? "Signing in…" : "Sign in"}
                </button>
              </form>
            </div>
          </div>

          {/* The platform panel: the service you are signing in to, wearing
              the same lit map as the front page — one identity everywhere. */}
          <aside className="login-aside login-aside-dark">
            {/* The map is the panel's atmosphere — an absolute, masked layer
                behind the words — so the panel never grows past the form and
                the whole page holds one viewport before the footer. */}
            {map && <div className="login-dark-map" aria-hidden="true">{map}</div>}
            <div className="login-dark-head">
              <div className="login-dark-kicker">Data Point · Staff Workspace</div>
              <div className="login-dark-title">One bank. Every figure accountable.</div>
              <p className="login-dark-sub">
                Uploads, commits, assessments and briefings — every action signed by the person who took it.
              </p>
            </div>

            <div className="eyebrow" style={{ color: "rgba(255,255,255,0.55)" }}>If you cannot sign in</div>
            <ul className="login-help-list login-help-dark">
              <li>Accounts are issued by the NEDB administrator, not self-registered.</li>
              <li>
                No account yet? <Link href="/portal" className="login-link">Request dashboard access</Link>, or{" "}
                <Link href="/portal/status" className="login-link">check a request you already made</Link>.
              </li>
              <li>Forgotten your password? Contact the NEDB administrator to have it reset.</li>
              <li>
                Only looking for statistics? All published data is{" "}
                <Link href="/" className="login-link">free to browse without an account</Link>.
              </li>
            </ul>

            <div className="login-notice login-notice-dark">
              This is an official service. Do not share your credentials. Your sign-in is recorded, and activity in the
              admin console is written to an audit log. Report suspicious activity to the ECN IT helpdesk.
            </div>
          </aside>
        </div>
      </main>

      {/* Compact statutory footer — the full site footer would reintroduce the scroll */}
      <footer className="login-footer">
        <div className="login-footer-inner">
          <span>
            &copy; {new Date().getFullYear()}{" "}Energy Commission of Nigeria &nbsp;·&nbsp; Established under the ECN Act, CAP. E10, LFN 2004
          </span>
          <span className="login-footer-links">
            <Link href="/privacy">Privacy</Link>
            <Link href="/accessibility">Accessibility</Link>
            <Link href="/terms-of-data-use">Terms of data use</Link>
            <a href="https://energy.gov.ng" target="_blank" rel="noopener noreferrer">energy.gov.ng</a>
          </span>
        </div>
      </footer>
    </div>
  );
}

export default function LoginClient({ map }: { map?: ReactNode }) {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", background: "var(--surface)" }} />}>
      <LoginForm map={map} />
    </Suspense>
  );
}
