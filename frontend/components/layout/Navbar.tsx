"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import CoatOfArms from "./CoatOfArms";
import { isLoggedIn, getFullName, getRole, clearTokens } from "@/lib/auth";

type NavbarProps = {
  active?: "databank" | "upload" | "datapoint" | "about";
};

export default function Navbar({ active }: NavbarProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [loggedIn, setLoggedIn]   = useState(false);
  const [name, setName]           = useState("");
  const [role, setRole]           = useState("");
  const router = useRouter();

  useEffect(() => {
    setLoggedIn(isLoggedIn());
    setName(getFullName());
    setRole(getRole());
  }, []);

  function logout() {
    clearTokens();
    setLoggedIn(false);
    setMenuOpen(false);
    router.push("/");
  }

  const portalHref = role === "admin" ? "/admin" : "/upload";
  const portalLabel = role === "admin" ? "Admin Panel" : "Upload Data";

  return (
    <>
      {/* Government top banner */}
      <div className="gov-banner">
        FEDERAL REPUBLIC OF NIGERIA &nbsp;&middot;&nbsp; ENERGY COMMISSION OF NIGERIA (ECN)
        &nbsp;&middot;&nbsp; ESTABLISHED UNDER ECN ACT, CAP. E10, LFN 2004
      </div>

      <nav className="primary-nav">
        {/* Brand */}
        <Link href="/" className="nav-brand" onClick={() => setMenuOpen(false)}>
          <CoatOfArms size={40} />
          <div className="brand-text">
            <span className="brand-primary">NEDB</span>
            <span className="brand-sub">National Energy Data Bank</span>
          </div>
        </Link>

        {/* Desktop links */}
        <div className="nav-links-main nav-desktop">
          <Link href="/" className={`nav-link-main${active === "databank" ? " active" : ""}`}>Data Bank</Link>
          <Link href="/data-point" className={`nav-link-main${active === "datapoint" ? " active" : ""}`}>Data Point</Link>
          <Link href="/portal" className="nav-link-main">Intelligence Portal</Link>
          <Link href="/about" className={`nav-link-main${active === "about" ? " active" : ""}`}>About NEDB</Link>
          <a href="https://energy.gov.ng" target="_blank" rel="noopener noreferrer" className="nav-link-main">ECN Website</a>
        </div>

        {/* Desktop actions */}
        <div className="nav-actions nav-desktop" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          {loggedIn ? (
            <>
              <span style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.55)", maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</span>
              <Link href={portalHref} className="btn btn-secondary btn-sm">{portalLabel}</Link>
              <button onClick={logout} className="btn btn-sm" style={{ background: "rgba(255,255,255,0.1)", color: "#fff", border: "1px solid rgba(255,255,255,0.2)" }}>Log Out</button>
            </>
          ) : (
            <Link href="/data-point/login" className="btn btn-primary btn-sm">Portal Login</Link>
          )}
        </div>

        {/* Mobile hamburger */}
        <button
          className="nav-hamburger"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Toggle menu"
        >
          <span style={{ display: "block", width: 20, height: 2, background: "#fff", marginBottom: 4, transition: "0.2s", transform: menuOpen ? "rotate(45deg) translate(4px,4px)" : "none" }} />
          <span style={{ display: "block", width: 20, height: 2, background: "#fff", marginBottom: 4, opacity: menuOpen ? 0 : 1, transition: "0.2s" }} />
          <span style={{ display: "block", width: 20, height: 2, background: "#fff", transition: "0.2s", transform: menuOpen ? "rotate(-45deg) translate(4px,-4px)" : "none" }} />
        </button>
      </nav>

      {/* Mobile drawer */}
      {menuOpen && (
        <div className="mobile-menu">
          <Link href="/" className={`mobile-link${active === "databank" ? " active" : ""}`} onClick={() => setMenuOpen(false)}>Data Bank</Link>
          <Link href="/data-point" className={`mobile-link${active === "datapoint" ? " active" : ""}`} onClick={() => setMenuOpen(false)}>Data Point</Link>
          <Link href="/portal" className="mobile-link" onClick={() => setMenuOpen(false)}>Intelligence Portal</Link>
          <Link href="/about" className={`mobile-link${active === "about" ? " active" : ""}`} onClick={() => setMenuOpen(false)}>About NEDB</Link>
          <a href="https://energy.gov.ng" target="_blank" rel="noopener noreferrer" className="mobile-link" onClick={() => setMenuOpen(false)}>ECN Website</a>
          <div style={{ padding: "1rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {loggedIn ? (
              <>
                {name && <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.5)", paddingLeft: 2 }}>Signed in as {name}</div>}
                <Link href={portalHref} className="btn btn-secondary" style={{ justifyContent: "center", width: "100%" }} onClick={() => setMenuOpen(false)}>{portalLabel}</Link>
                <button onClick={logout} className="btn" style={{ background: "rgba(255,255,255,0.08)", color: "#fff", border: "1px solid rgba(255,255,255,0.15)", justifyContent: "center", width: "100%" }}>Log Out</button>
              </>
            ) : (
              <Link href="/data-point/login" className="btn btn-primary" style={{ justifyContent: "center", width: "100%" }} onClick={() => setMenuOpen(false)}>Portal Login</Link>
            )}
          </div>
        </div>
      )}
    </>
  );
}
