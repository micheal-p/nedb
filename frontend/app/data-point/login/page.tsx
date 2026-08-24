"use client";

// ── Staff sign-in ───────────────────────────────────────────────────────────
// A government sign-in page has one job: get an authorised person in, and tell
// everyone else exactly what to do instead. The previous version was a split
// marketing screen explaining the role model to people who already know their
// role, and its security notice was factually wrong.

import { useState, useEffect, Suspense } from "react";
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

function LoginForm() {
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
      saveTokens(result.token, result.refresh_token, result.full_name, result.role, result.dashboard_profile);
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
    <div style={{ minHeight: "100vh", background: "var(--surface-muted)", display: "flex", flexDirection: "column" }}>
      {/* Official banner */}
      <div className="gov-banner">
        FEDERAL REPUBLIC OF NIGERIA &nbsp;&middot;&nbsp; ENERGY COMMISSION OF NIGERIA (ECN)
      </div>

      <main style={{ flex: 1, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "3rem 1.25rem 4rem" }}>
        <div style={{ width: "100%", maxWidth: 440 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: "1.75rem" }}>
            <CoatOfArms size={46} />
            <div>
              <div style={{ fontSize: "1rem", fontWeight: 700, color: "var(--ink)", lineHeight: 1.15 }}>National Energy Data Bank</div>
              <div style={{ fontSize: "0.68rem", color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Staff sign-in</div>
            </div>
          </div>

          <ErrorSummary errors={errors} />

          <div style={{ background: "var(--surface-white)", border: "1px solid var(--border)", padding: "1.75rem" }}>
            <h1 style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--ink)", marginBottom: "0.4rem" }}>Sign in</h1>
            <p style={{ fontSize: "0.8rem", color: "var(--ink-3)", marginBottom: "1.5rem", lineHeight: 1.6 }}>
              For Energy Commission of Nigeria staff and authorised agency personnel. You are taken to your own
              workspace automatically once signed in.
            </p>

            <form onSubmit={handleSubmit} noValidate>
              <div className="form-group">
                <label className="form-label" htmlFor="username">Username</label>
                <input
                  id="username"
                  className="form-input"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  autoFocus
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="password">Password</label>
                <div style={{ position: "relative" }}>
                  <input
                    id="password"
                    className="form-input"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyUp={(e) => setCapsOn(e.getModifierState?.("CapsLock") ?? false)}
                    autoComplete="current-password"
                    style={{ paddingRight: "4.25rem" }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-pressed={showPassword}
                    style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", fontSize: "0.72rem", fontWeight: 600, color: "var(--blue)", cursor: "pointer", textDecoration: "underline", textUnderlineOffset: 2 }}
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
                {capsOn && (
                  <div style={{ fontSize: "0.72rem", color: "var(--amber)", fontWeight: 600, marginTop: 5 }}>
                    Caps Lock is on.
                  </div>
                )}
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                disabled={loading}
                style={{ width: "100%", justifyContent: "center", padding: "0.75rem 1.5rem", fontSize: "0.9rem", marginTop: "0.5rem" }}
              >
                {loading ? "Signing in…" : "Sign in"}
              </button>
            </form>
          </div>

          {/* What to do if you cannot sign in — the part a government page owes the visitor */}
          <div style={{ background: "var(--surface-white)", border: "1px solid var(--border)", borderTop: "none", padding: "1.25rem 1.75rem" }}>
            <div style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--ink-4)", marginBottom: "0.6rem" }}>
              If you cannot sign in
            </div>
            <ul style={{ margin: 0, paddingLeft: "1.1rem", fontSize: "0.8rem", color: "var(--ink-3)", lineHeight: 1.9 }}>
              <li>Accounts are issued by the NEDB administrator, not self-registered.</li>
              <li>
                No account yet? <Link href="/portal" style={{ color: "var(--green)", fontWeight: 600, textDecoration: "underline", textUnderlineOffset: 2 }}>Request dashboard access</Link>, or{" "}
                <Link href="/portal/status" style={{ color: "var(--green)", fontWeight: 600, textDecoration: "underline", textUnderlineOffset: 2 }}>check a request you already made</Link>.
              </li>
              <li>Forgotten your password? Contact the NEDB administrator to have it reset.</li>
              <li>
                Only looking for statistics? All published data is{" "}
                <Link href="/" style={{ color: "var(--green)", fontWeight: 600, textDecoration: "underline", textUnderlineOffset: 2 }}>free to browse without an account</Link>.
              </li>
            </ul>
          </div>

          <p style={{ fontSize: "0.72rem", color: "var(--ink-4)", lineHeight: 1.7, marginTop: "1.25rem" }}>
            This is an official service. Do not share your credentials. Your sign-in is recorded, and activity in the
            admin console is written to an audit log. Report suspicious activity to the ECN IT helpdesk.
          </p>

          <div style={{ marginTop: "1.25rem", fontSize: "0.72rem", color: "var(--ink-5)", lineHeight: 1.7, borderTop: "1px solid var(--border)", paddingTop: "1rem" }}>
            Energy Commission of Nigeria &nbsp;·&nbsp;{" "}
            <a href="https://energy.gov.ng" target="_blank" rel="noopener noreferrer" style={{ color: "var(--green)" }}>energy.gov.ng</a>
            <br />
            Established under the ECN Act, CAP. E10, LFN 2004 &nbsp;·&nbsp;{" "}
            <Link href="/privacy" style={{ color: "var(--ink-4)", textDecoration: "underline", textUnderlineOffset: 2 }}>Privacy</Link>
            {" · "}
            <Link href="/accessibility" style={{ color: "var(--ink-4)", textDecoration: "underline", textUnderlineOffset: 2 }}>Accessibility</Link>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", background: "var(--surface-muted)" }} />}>
      <LoginForm />
    </Suspense>
  );
}
