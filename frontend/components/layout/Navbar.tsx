"use client";

import Link from "next/link";
import { useState } from "react";
import CoatOfArms from "./CoatOfArms";

type NavbarProps = {
  active?: "databank" | "upload" | "datapoint" | "about";
};

export default function Navbar({ active }: NavbarProps) {
  const [menuOpen, setMenuOpen] = useState(false);

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
          <Link href="/about" className={`nav-link-main${active === "about" ? " active" : ""}`}>About NEDB</Link>
          <a href="https://energy.gov.ng" target="_blank" rel="noopener noreferrer" className="nav-link-main">ECN Website</a>
        </div>

        {/* Desktop actions */}
        <div className="nav-actions nav-desktop">
          <Link href="/data-point/login" className="btn btn-primary btn-sm">Portal Login</Link>
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
          <Link href="/about" className={`mobile-link${active === "about" ? " active" : ""}`} onClick={() => setMenuOpen(false)}>About NEDB</Link>
          <a href="https://energy.gov.ng" target="_blank" rel="noopener noreferrer" className="mobile-link" onClick={() => setMenuOpen(false)}>ECN Website</a>
          <div style={{ padding: "1rem" }}>
            <Link href="/data-point/login" className="btn btn-primary" style={{ justifyContent: "center", width: "100%" }} onClick={() => setMenuOpen(false)}>Portal Login</Link>
          </div>
        </div>
      )}
    </>
  );
}
