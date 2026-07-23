"use client";

// ── AdminShell.tsx ──────────────────────────────────────────────────────────
// SAP-style enterprise console frame for every /admin page: a persistent
// dark left rail with grouped modules, a slim top bar (section title + user +
// logout), and the page content in the main region. Replaces the scattered
// per-page button rows — nav lives here once, driven by lib/admin-modules.ts.

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import CoatOfArms from "@/components/layout/CoatOfArms";
import { getToken, getRole, getFullName, clearTokens } from "@/lib/auth";
import { ADMIN_NAV, ADMIN_ICONS, adminSectionTitle } from "@/lib/admin-modules";

function Icon({ name }: { name: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      <path d={ADMIN_ICONS[name] ?? ADMIN_ICONS.grid} />
    </svg>
  );
}

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [name, setName] = useState("");
  const [ready, setReady] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    // Every admin route is gated here — one guard for the whole console.
    if (!getToken()) { router.replace(`/data-point/login?redirect=${encodeURIComponent(pathname)}`); return; }
    if (getRole() !== "admin") { router.replace("/"); return; }
    setName(getFullName());
    setReady(true);
  }, [router, pathname]);

  useEffect(() => { setMobileOpen(false); }, [pathname]);

  function logout() { clearTokens(); window.location.href = "/"; }

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(href + "/");

  if (!ready) {
    return <div style={{ minHeight: "100vh", background: "var(--surface)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--ink-5)", fontSize: "0.85rem" }}>Verifying access…</div>;
  }

  const rail = (
    <nav style={{ width: 256, minWidth: 256, background: "#0C1710", color: "rgba(255,255,255,0.85)", display: "flex", flexDirection: "column", height: "100vh", position: "sticky", top: 0 }}>
      <Link href="/admin" style={{ display: "flex", alignItems: "center", gap: 10, padding: "1.1rem 1.25rem", borderBottom: "1px solid rgba(255,255,255,0.08)", textDecoration: "none" }}>
        <CoatOfArms size={30} />
        <div style={{ lineHeight: 1.2 }}>
          <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "#fff" }}>NEDB Console</div>
          <div style={{ fontSize: "0.56rem", color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.1em" }}>Administration</div>
        </div>
      </Link>

      <div style={{ flex: 1, overflowY: "auto", padding: "0.75rem 0" }}>
        {ADMIN_NAV.map((g) => (
          <div key={g.group} style={{ marginBottom: "0.5rem" }}>
            <div style={{ fontSize: "0.56rem", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.32)", padding: "0.5rem 1.25rem 0.35rem" }}>{g.group}</div>
            {g.items.map((it) => {
              const active = isActive(it.href, it.exact);
              return (
                <Link key={it.href} href={it.href}
                  style={{ display: "flex", alignItems: "center", gap: 11, padding: "0.55rem 1.25rem", fontSize: "0.8rem", textDecoration: "none",
                    color: active ? "#fff" : "rgba(255,255,255,0.7)",
                    background: active ? "rgba(14,122,60,0.22)" : "transparent",
                    borderLeft: `3px solid ${active ? "var(--green)" : "transparent"}` }}>
                  <span style={{ opacity: active ? 1 : 0.65 }}><Icon name={it.icon} /></span>
                  <span>{it.label}</span>
                </Link>
              );
            })}
          </div>
        ))}
      </div>

      <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", padding: "0.875rem 1.25rem" }}>
        <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name || "Administrator"}</div>
        <button onClick={logout} style={{ marginTop: 6, fontSize: "0.7rem", fontWeight: 700, color: "#fca5a5", background: "none", border: "none", padding: 0, cursor: "pointer" }}>Log out →</button>
      </div>
    </nav>
  );

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--surface)" }}>
      {/* Desktop rail */}
      <div className="admin-rail-desktop" style={{ display: "flex" }}>{rail}</div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <>
          <div onClick={() => setMobileOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 90 }} />
          <div style={{ position: "fixed", top: 0, left: 0, bottom: 0, zIndex: 91 }}>{rail}</div>
        </>
      )}

      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        {/* Slim top bar */}
        <div style={{ height: 52, background: "#fff", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 12, padding: "0 1.25rem", position: "sticky", top: 0, zIndex: 20 }}>
          <button className="admin-rail-toggle" onClick={() => setMobileOpen((o) => !o)} aria-label="Menu"
            style={{ display: "none", flexDirection: "column", gap: 4, background: "none", border: "none", cursor: "pointer", padding: 4 }}>
            <span style={{ width: 18, height: 2, background: "var(--ink-3)" }} />
            <span style={{ width: 18, height: 2, background: "var(--ink-3)" }} />
            <span style={{ width: 18, height: 2, background: "var(--ink-3)" }} />
          </button>
          <span style={{ fontSize: "0.6rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--green)" }}>Admin</span>
          <span style={{ color: "var(--ink-5)" }}>›</span>
          <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--ink)" }}>{adminSectionTitle(pathname)}</span>
        </div>

        <main style={{ flex: 1, minWidth: 0 }}>{children}</main>
      </div>

      <style>{`
        @media (max-width: 860px) {
          .admin-rail-desktop { display: none !important; }
          .admin-rail-toggle  { display: flex !important; }
        }
      `}</style>
    </div>
  );
}
