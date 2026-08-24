"use client";

// ── TerminalShell ───────────────────────────────────────────────────────────
// The Data Terminal is a workspace, not a page in a console. It owns the whole
// journey of a figure — entry, validation, review, commit, publication — and is
// laid out for someone who sits in it all day: a fixed rail, dense type, keyboard
// shortcuts, and a status strip that always says what is waiting.

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import CoatOfArms from "@/components/layout/CoatOfArms";
import { getToken, getRole, getFullName, clearTokens, isAdminRole, isEditorRole, ROLE_LABELS } from "@/lib/auth";

const NAV = [
  { href: "/terminal",          label: "Pipeline",  key: "1", exact: true, blurb: "Everything in flight" },
  { href: "/terminal/entry",    label: "Entry",     key: "2", blurb: "Key figures into the grid" },
  { href: "/terminal/review",   label: "Review",    key: "3", blurb: "Batches awaiting a decision" },
  { href: "/terminal/coverage", label: "Coverage",  key: "4", blurb: "What is stale or missing" },
];

export default function TerminalShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [clock, setClock] = useState("");

  useEffect(() => {
    if (!getToken()) { router.replace(`/data-point/login?redirect=${encodeURIComponent(pathname)}`); return; }
    // The terminal writes data, so it is editors and above only.
    if (!isEditorRole(getRole())) { router.replace("/data-point/dashboard"); return; }
    setName(getFullName()); setRole(getRole()); setReady(true);
    const tick = () => setClock(new Date().toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit" }));
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, [router, pathname]);

  // Alt+number jumps between stations, the way a terminal should behave
  const onKey = useCallback((e: KeyboardEvent) => {
    if (!e.altKey || e.metaKey || e.ctrlKey) return;
    const hit = NAV.find((n) => n.key === e.key);
    if (hit) { e.preventDefault(); router.push(hit.href); }
  }, [router]);
  useEffect(() => {
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onKey]);

  if (!ready) return <div style={{ minHeight: "100vh", background: "var(--surface)" }} />;

  return (
    <div className="term-shell">
      <aside className="term-rail">
        <Link href="/terminal" className="term-brand">
          <CoatOfArms size={26} />
          <div>
            <div className="term-brand-name">DATA TERMINAL</div>
            <div className="term-brand-sub">NEDB · ECN</div>
          </div>
        </Link>

        <nav className="term-nav">
          {NAV.map((n) => {
            const active = n.exact ? pathname === n.href : pathname.startsWith(n.href);
            return (
              <Link key={n.href} href={n.href} className={`term-nav-link${active ? " is-active" : ""}`}>
                <span className="term-nav-label">{n.label}</span>
                <span className="term-nav-key">⌥{n.key}</span>
                <span className="term-nav-blurb">{n.blurb}</span>
              </Link>
            );
          })}
        </nav>

        <div className="term-rail-foot">
          <div className="term-user">
            <div className="term-user-name">{name}</div>
            <div className="term-user-role">{ROLE_LABELS[role] ?? role}</div>
          </div>
          {isAdminRole(role) && <Link href="/admin" className="term-exit">Admin console</Link>}
          <Link href="/data-point/dashboard" className="term-exit">Dashboard</Link>
          <button onClick={() => { clearTokens(); router.replace("/data-point/login"); }} className="term-exit term-exit-out">Sign out</button>
        </div>
      </aside>

      <div className="term-main">
        <div className="term-topbar">
          <span className="term-topbar-title">
            {NAV.find((n) => (n.exact ? pathname === n.href : pathname.startsWith(n.href)))?.label ?? "Terminal"}
          </span>
          <span className="term-topbar-meta">{clock}</span>
        </div>
        <div className="term-body">{children}</div>
      </div>
    </div>
  );
}
