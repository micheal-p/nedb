// ── lib/admin-modules.ts ────────────────────────────────────────────────────
// The admin console's module registry — a single source of truth for the
// SAP-style grouped left navigation (components/admin/AdminShell.tsx). Add a
// destination here and it appears in the sidebar everywhere; nothing is
// hand-listed per page anymore.

export type AdminItem = {
  href: string;
  label: string;
  exact?: boolean;   // active only on the exact path (else prefix match)
  icon: string;      // key into ADMIN_ICONS
};

export type AdminGroup = { group: string; items: AdminItem[] };

export const ADMIN_NAV: AdminGroup[] = [
  {
    group: "Data & Records",
    items: [
      { href: "/admin", label: "Administration", exact: true, icon: "grid" },
      { href: "/admin/databank", label: "Storage Bank", icon: "database" },
      { href: "/admin/custom-tables", label: "Custom Tables", icon: "table" },
      { href: "/upload", label: "Upload Data", icon: "upload" },
      { href: "/admin/freshness", label: "Data Freshness", icon: "pulse" },
    ],
  },
  {
    group: "Assessments",
    items: [
      { href: "/admin/pena", label: "PENA Assessments", exact: true, icon: "clipboard" },
      { href: "/admin/pena/benchmarks", label: "NBS Benchmarks", icon: "scale" },
    ],
  },
  {
    group: "Dashboards",
    items: [
      { href: "/admin/dashboards", label: "Dashboard Builder", icon: "layout" },
      { href: "/data-point/dashboard", label: "Live Dashboard", icon: "chart" },
    ],
  },
  {
    group: "Intelligence",
    items: [
      { href: "/admin/apex", label: "Apex AI", icon: "spark" },
      { href: "/knowledge-graph", label: "Knowledge Graph", icon: "graph" },
    ],
  },
  {
    group: "Outreach",
    items: [
      { href: "/admin/subscribers", label: "Report & Subscribers", icon: "mail" },
    ],
  },
];

// Minimal line-icon paths (24×24, stroke). Kept here so the sidebar stays
// dependency-free and every module renders a consistent glyph.
export const ADMIN_ICONS: Record<string, string> = {
  grid:      "M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z",
  database:  "M12 3c4.4 0 8 1.3 8 3s-3.6 3-8 3-8-1.3-8-3 3.6-3 8-3zM4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6",
  table:     "M3 3h18v18H3zM3 9h18M3 15h18M9 3v18",
  upload:    "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12",
  pulse:     "M3 12h4l3 8 4-16 3 8h4",
  clipboard: "M9 2h6a1 1 0 0 1 1 1v2H8V3a1 1 0 0 1 1-1zM8 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2",
  scale:     "M12 3v18M5 7h14M7 7l-3 7a3 3 0 0 0 6 0zM17 7l-3 7a3 3 0 0 0 6 0z",
  layout:    "M3 3h18v18H3zM3 9h18M9 21V9",
  chart:     "M3 3v18h18M7 15l3-4 3 3 5-7",
  spark:     "M12 2l2.4 6.8L21 11l-6.6 2.2L12 20l-2.4-6.8L3 11l6.6-2.2z",
  graph:     "M5 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM12 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM7 7l4 8M17 7l-4 8",
  mail:      "M3 5h18v14H3zM3 6l9 7 9-7",
};

// The section title shown in the top bar for the active route.
export function adminSectionTitle(pathname: string): string {
  let best: AdminItem | null = null;
  for (const g of ADMIN_NAV) {
    for (const it of g.items) {
      const hit = it.exact ? pathname === it.href : pathname === it.href || pathname.startsWith(it.href + "/");
      if (hit && (!best || it.href.length > best.href.length)) best = it;
    }
  }
  return best?.label ?? "Administration";
}
