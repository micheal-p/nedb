"use client";

import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import CoatOfArms from "./CoatOfArms";
import { isLoggedIn, getFullName, getRole, clearTokens } from "@/lib/auth";

type NavbarProps = {
  active?: "databank" | "upload" | "datapoint" | "about";
};

export default function Navbar({ active }: NavbarProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const [name, setName]         = useState("");
  const [role, setRole]         = useState("");
  const drawerRef    = useRef<HTMLDivElement>(null);
  const hamburgerRef = useRef<HTMLButtonElement>(null);
  const router = useRouter();

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
          <Link href="/portal" className="nav-link-main">Intelligence Portal</Link>
          <Link href="/about" className={`nav-link-main${active === "about" ? " active" : ""}`}>About NEDB</Link>
          <Link href="/api-docs" className="nav-link-main">API</Link>
          <a href="https://energy.gov.ng" target="_blank" rel="noopener noreferrer" className="nav-link-main">ECN Website</a>
        </div>

        <div className="nav-actions nav-desktop" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          {loggedIn ? (
            <>
              <span style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.5)", maxWidth: 130, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</span>
              <Link href={portalHref} className="btn btn-ghost btn-sm">{portalLabel}</Link>
              <button onClick={logout} className="btn btn-ghost btn-sm">Log Out</button>
            </>
          ) : (
            <Link href="/data-point/login" className="btn btn-primary btn-sm">Portal Login</Link>
          )}
        </div>

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
          <Link href="/portal" className="mobile-link" onClick={() => setMenuOpen(false)}>Intelligence Portal</Link>
          <Link href="/about" className={`mobile-link${active === "about" ? " active" : ""}`} onClick={() => setMenuOpen(false)}>About NEDB</Link>
          <Link href="/api-docs" className="mobile-link" onClick={() => setMenuOpen(false)}>API Docs</Link>
          <a href="https://energy.gov.ng" target="_blank" rel="noopener noreferrer" className="mobile-link" onClick={() => setMenuOpen(false)}>ECN Website</a>

          <div className="mobile-auth-section">
            {loggedIn ? (
              <>
                {name && <div className="mobile-auth-name">Signed in as {name}</div>}
                <Link href={portalHref} className="mobile-auth-btn mobile-auth-btn--portal" onClick={() => setMenuOpen(false)}>
                  {portalLabel}
                </Link>
                <button onClick={logout} className="mobile-auth-btn mobile-auth-btn--logout">
                  Log Out
                </button>
              </>
            ) : (
              <Link href="/data-point/login" className="mobile-auth-btn mobile-auth-btn--login" onClick={() => setMenuOpen(false)}>
                Portal Login
              </Link>
            )}
          </div>
        </div>
      )}
    </>
  );
}
