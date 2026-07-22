"use client";

import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import CoatOfArms from "./CoatOfArms";
import { isLoggedIn, getFullName, getRole, clearTokens } from "@/lib/auth";

type NavbarProps = {
  active?: "databank" | "upload" | "datapoint" | "about" | "graph" | "assessments";
};

export default function Navbar({ active }: NavbarProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [exploreOpen, setExploreOpen] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const [name, setName]         = useState("");
  const [role, setRole]         = useState("");
  const drawerRef    = useRef<HTMLDivElement>(null);
  const hamburgerRef = useRef<HTMLButtonElement>(null);
  const exploreRef   = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Close the Explore dropdown on click-outside
  useEffect(() => {
    if (!exploreOpen) return;
    function handle(e: MouseEvent) {
      if (exploreRef.current && !exploreRef.current.contains(e.target as Node)) setExploreOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [exploreOpen]);

  useEffect(() => {
    setLoggedIn(isLoggedIn());
    setName(getFullName());
    setRole(getRole());
  }, []);

  // Close on click-outside
  useEffect(() => {
    if (!menuOpen) return;
    function handle(e: MouseEvent) {
      if (
        drawerRef.current    && !drawerRef.current.contains(e.target as Node) &&
        hamburgerRef.current && !hamburgerRef.current.contains(e.target as Node)
      ) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [menuOpen]);

  function logout() {
    clearTokens();
    setLoggedIn(false);
    setMenuOpen(false);
    router.push("/");
  }

  const portalHref  = role === "admin" ? "/admin" : "/upload";
  const portalLabel = role === "admin" ? "Admin Panel" : "Upload Data";

  return (
    <>
      <div className="gov-banner">
        FEDERAL REPUBLIC OF NIGERIA &nbsp;&middot;&nbsp; ENERGY COMMISSION OF NIGERIA (ECN)
        &nbsp;&middot;&nbsp; ESTABLISHED UNDER ECN ACT, CAP. E10, LFN 2004
      </div>

      <nav className="primary-nav">
        <Link href="/" className="nav-brand" onClick={() => setMenuOpen(false)}>
          <CoatOfArms size={40} />
          <div className="brand-text">
            <span className="brand-primary">NEDB</span>
            <span className="brand-sub">National Energy Data Bank</span>
          </div>
        </Link>

        <div className="nav-links-main nav-desktop">
          <Link href="/" className={`nav-link-main${active === "databank" ? " active" : ""}`}>Data Bank</Link>
          <Link href="/data-point" className={`nav-link-main${active === "datapoint" ? " active" : ""}`}>Data Point</Link>

          {/* Explore ▾ — Knowledge Graph, PENA, Intelligence Portal, API */}
          {/* Hover-open is mouse-only: on touch, a tap fires synthetic
              mouseenter THEN click, which would open-then-toggle-closed */}
          <div ref={exploreRef} style={{ position: "relative" }}
            onPointerEnter={(e) => e.pointerType === "mouse" && setExploreOpen(true)}
            onPointerLeave={(e) => e.pointerType === "mouse" && setExploreOpen(false)}>
            <button
              className={`nav-link-main${active === "graph" || active === "assessments" ? " active" : ""}`}
              onClick={() => setExploreOpen((o) => !o)}
              aria-expanded={exploreOpen}
              style={{ background: "none", border: "none", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 5, font: "inherit" }}>
              Explore
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"
                style={{ transition: "transform 0.15s", transform: exploreOpen ? "rotate(180deg)" : "none" }}>
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
            {exploreOpen && (
              <div style={{ position: "absolute", top: "100%", left: 0, minWidth: 220, background: "#fff", border: "1px solid var(--border)", borderRadius: 8, boxShadow: "0 16px 40px rgba(0,0,0,0.16)", padding: "0.4rem 0", zIndex: 60 }}>
                {[
                  { href: "/knowledge-graph", label: "Knowledge Graph",     sub: "Supply-chain network & SPOF analysis" },
                  { href: "/assessments",     label: "PENA Assessments",    sub: "Energy needs surveys — open data" },
                  { href: "/portal",          label: "Intelligence Portal", sub: "Request analyst & investor access" },
                  { href: "/api-docs",        label: "API",                 sub: "Programmatic access & docs" },
                ].map((item) => (
                  <Link key={item.href} href={item.href} onClick={() => setExploreOpen(false)}
                    style={{ display: "block", padding: "0.55rem 1rem", textDecoration: "none" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "var(--green-tint)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "none")}>
                    <span style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "var(--ink)" }}>{item.label}</span>
                    <span style={{ display: "block", fontSize: "0.68rem", color: "var(--ink-4)", marginTop: 1 }}>{item.sub}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>

          <Link href="/about" className={`nav-link-main${active === "about" ? " active" : ""}`}>About NEDB</Link>
          <a href="https://energy.gov.ng" target="_blank" rel="noopener noreferrer" className="nav-link-main">ECN Website</a>
        </div>

        {loggedIn && (
          <div className="nav-actions nav-desktop" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.5)", maxWidth: 130, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</span>
            <Link href={portalHref} className="btn btn-ghost btn-sm">{portalLabel}</Link>
            <button onClick={logout} className="btn btn-ghost btn-sm">Log Out</button>
          </div>
        )}

        <button
          ref={hamburgerRef}
          className="nav-hamburger"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Toggle menu"
        >
          <span style={{ display: "block", width: 20, height: 2, background: "#fff", marginBottom: 4, transition: "0.2s", transform: menuOpen ? "rotate(45deg) translate(4px,4px)" : "none" }} />
          <span style={{ display: "block", width: 20, height: 2, background: "#fff", marginBottom: 4, opacity: menuOpen ? 0 : 1, transition: "0.2s" }} />
          <span style={{ display: "block", width: 20, height: 2, background: "#fff", transition: "0.2s", transform: menuOpen ? "rotate(-45deg) translate(4px,-4px)" : "none" }} />
        </button>
      </nav>

      {menuOpen && (
        <div className="mobile-menu" ref={drawerRef}>
          <Link href="/" className={`mobile-link${active === "databank" ? " active" : ""}`} onClick={() => setMenuOpen(false)}>Data Bank</Link>
          <Link href="/data-point" className={`mobile-link${active === "datapoint" ? " active" : ""}`} onClick={() => setMenuOpen(false)}>Data Point</Link>
          <div style={{ padding: "0.6rem 1rem 0.2rem", fontSize: "0.6rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)" }}>Explore</div>
          <Link href="/knowledge-graph" className={`mobile-link${active === "graph" ? " active" : ""}`} onClick={() => setMenuOpen(false)}>Knowledge Graph</Link>
          <Link href="/assessments" className={`mobile-link${active === "assessments" ? " active" : ""}`} onClick={() => setMenuOpen(false)}>PENA Assessments</Link>
          <Link href="/portal" className="mobile-link" onClick={() => setMenuOpen(false)}>Intelligence Portal</Link>
          <Link href="/about" className={`mobile-link${active === "about" ? " active" : ""}`} onClick={() => setMenuOpen(false)}>About NEDB</Link>
          <Link href="/api-docs" className="mobile-link" onClick={() => setMenuOpen(false)}>API Docs</Link>
          <a href="https://energy.gov.ng" target="_blank" rel="noopener noreferrer" className="mobile-link" onClick={() => setMenuOpen(false)}>ECN Website</a>

          {loggedIn && (
            <div className="mobile-auth-section">
              {name && <div className="mobile-auth-name">Signed in as {name}</div>}
              <Link href={portalHref} className="mobile-auth-btn mobile-auth-btn--portal" onClick={() => setMenuOpen(false)}>
                {portalLabel}
              </Link>
              <button onClick={logout} className="mobile-auth-btn mobile-auth-btn--logout">
                Log Out
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
}
