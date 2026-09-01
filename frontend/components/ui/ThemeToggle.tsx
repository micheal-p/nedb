"use client";

// Appearance switcher: System → Light → Dark → High contrast.
// The choice persists in localStorage and is applied before first paint by
// the boot script in layout.tsx; this control only has to keep the two in
// step. High contrast is a first-class theme sharing the token system, not a
// filter bolted on afterwards.

import { useState, useEffect, useCallback } from "react";

type Mode = "system" | "light" | "dark" | "contrast";
const ORDER: Mode[] = ["system", "light", "dark", "contrast"];
const LABEL: Record<Mode, string> = {
  system: "Appearance: system",
  light: "Appearance: light",
  dark: "Appearance: dark",
  contrast: "Appearance: high contrast",
};
const SHORT: Record<Mode, string> = { system: "Auto", light: "Light", dark: "Dark", contrast: "Contrast" };

function apply(mode: Mode) {
  const root = document.documentElement;
  if (mode === "dark" || mode === "contrast") root.dataset.theme = mode;
  else if (mode === "light") delete root.dataset.theme;
  else {
    // system: follow the OS
    if (window.matchMedia("(prefers-color-scheme: dark)").matches) root.dataset.theme = "dark";
    else delete root.dataset.theme;
  }
}

export default function ThemeToggle({ compact }: { compact?: boolean }) {
  const [mode, setMode] = useState<Mode>("system");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      const saved = localStorage.getItem("nedb_theme") as Mode | null;
      if (saved && ORDER.includes(saved)) setMode(saved);
    } catch { /* private mode */ }
  }, []);

  const cycle = useCallback(() => {
    const next = ORDER[(ORDER.indexOf(mode) + 1) % ORDER.length];
    setMode(next);
    try {
      if (next === "system") localStorage.removeItem("nedb_theme");
      else localStorage.setItem("nedb_theme", next);
    } catch { /* private mode */ }
    apply(next);
  }, [mode]);

  // Render a stable placeholder until mounted so SSR and client agree.
  // Compact form (the nav bars): a quiet icon-only button — the boxed text
  // pill shouted louder than links that matter. The current mode lives in the
  // tooltip and the accessible label, and a two-letter whisper appears only
  // when a non-default mode is active, so "something is switched on" stays
  // visible without the furniture.
  const active = mounted && mode !== "system";
  if (compact) {
    return (
      <button
        type="button"
        onClick={cycle}
        aria-label={mounted ? `${LABEL[mode]} — activate to change` : "Change appearance"}
        title={mounted ? LABEL[mode] : "Appearance"}
        style={{
          display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 5,
          minWidth: 30, height: 30, padding: active ? "0 9px" : 0,
          background: "transparent",
          border: "none",
          borderRadius: 15,
          color: "inherit",
          opacity: active ? 0.95 : 0.6,
          fontSize: "var(--t-2xs)", fontWeight: 700, letterSpacing: "0.08em",
          textTransform: "uppercase", cursor: "pointer",
        }}
        onMouseEnter={(e) => { e.currentTarget.style.opacity = "1"; e.currentTarget.style.background = "rgba(127,127,127,0.18)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.opacity = active ? "0.95" : "0.6"; e.currentTarget.style.background = "transparent"; }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 3 a9 9 0 0 1 0 18 Z" fill="currentColor" stroke="none" />
        </svg>
        {active && SHORT[mode]}
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={cycle}
      aria-label={mounted ? `${LABEL[mode]} — activate to change` : "Change appearance"}
      title={mounted ? LABEL[mode] : "Appearance"}
      style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        padding: "6px 12px",
        background: "transparent",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-sm)",
        color: "inherit",
        fontSize: "var(--t-2xs)", fontWeight: 700, letterSpacing: "0.06em",
        textTransform: "uppercase", cursor: "pointer",
      }}
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 3 a9 9 0 0 1 0 18 Z" fill="currentColor" stroke="none" />
      </svg>
      {mounted ? SHORT[mode] : "Auto"}
    </button>
  );
}
