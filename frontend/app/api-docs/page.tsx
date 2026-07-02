import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";

const BASE = "https://nedb.vercel.app";

interface Endpoint {
  method: "GET" | "POST" | "PATCH" | "DELETE";
  path: string;
  auth?: boolean;
  description: string;
  params?: { name: string; in: "query" | "path" | "body"; type: string; required?: boolean; description: string }[];
  example?: string;
  response?: string;
}

const ENDPOINTS: Endpoint[] = [
  {
    method: "GET",
    path: "/api/series",
    description: "List all active data series. Returns metadata, frequency, and record count for each series.",
    response: `[{ "id": "crude_oil_production", "name": "Crude Oil Production", "sector": "petroleum", "unit_default": "M Barrels", "frequency": "monthly", "viz_types": ["line","stacked-area"], "record_count": 48 }]`,
  },
  {
    method: "GET",
    path: "/api/series/{id}",
    description: "Full metadata for a single series.",
    params: [{ name: "id", in: "path", type: "string", required: true, description: "Series type ID, e.g. crude_oil_production" }],
    response: `{ "id": "...", "name": "...", "sector": "...", "unit_default": "M Barrels", "frequency": "monthly" }`,
  },
  {
    method: "GET",
    path: "/api/series/{id}/data",
    description: "Paginated time-series records for a series. Filterable by region, period range, and page.",
    params: [
      { name: "id",          in: "path",  type: "string",  required: true,  description: "Series type ID" },
      { name: "region",      in: "query", type: "string",  required: false, description: "ISO 3166-2:NG state or NGA for national" },
      { name: "period_from", in: "query", type: "string",  required: false, description: "Start period, e.g. 2020-01" },
      { name: "period_to",   in: "query", type: "string",  required: false, description: "End period, e.g. 2024-12" },
      { name: "page",        in: "query", type: "integer", required: false, description: "Page number (default 1)" },
      { name: "limit",       in: "query", type: "integer", required: false, description: "Records per page (max 500, default 100)" },
    ],
    example: `GET ${BASE}/api/series/crude_oil_production/data?period_from=2022-01&period_to=2023-12`,
    response: `{ "rows": [...], "total": 24, "page": 1, "limit": 100 }`,
  },
  {
    method: "GET",
    path: "/api/series/{id}/stats",
    description: "Auto-computed statistics: latest value, YoY change, MoM change, CAGR, rolling 3-period and 12-period averages.",
    params: [{ name: "id", in: "path", type: "string", required: true, description: "Series type ID" }],
    response: `{ "latest": 85.4, "latest_period": "2024-06", "yoy_pct": 3.2, "mom_pct": -1.1, "cagr": 2.8, "rolling_3": 84.1, "rolling_12": 83.7, "unit": "M Barrels" }`,
  },
  {
    method: "GET",
    path: "/api/series/{id}/export",
    description: "Download all records for a series as CSV or Excel (XLSX). Excel includes a metadata sheet.",
    params: [
      { name: "id",     in: "path",  type: "string", required: true,  description: "Series type ID" },
      { name: "format", in: "query", type: "string", required: false, description: "csv (default) or xlsx" },
      { name: "year",   in: "query", type: "string", required: false, description: "Filter by year, e.g. 2023" },
      { name: "region", in: "query", type: "string", required: false, description: "Filter by region" },
    ],
    example: `GET ${BASE}/api/series/electricity_generation/export?format=xlsx&year=2023`,
  },
  {
    method: "POST",
    path: "/api/iot/ingest",
    auth: true,
    description: "Real-time data ingest from IoT field devices and EOM systems. Accepts a single reading or a batch of up to 100 readings. Authenticate with X-API-Key header.",
    params: [
      { name: "series_type_id", in: "body", type: "string",  required: true,  description: "Target series" },
      { name: "period",         in: "body", type: "string",  required: true,  description: "e.g. 2026-06 or 2026-Q2" },
      { name: "period_date",    in: "body", type: "string",  required: true,  description: "ISO date e.g. 2026-06-01" },
      { name: "value",          in: "body", type: "number",  required: true,  description: "Numeric reading" },
      { name: "unit",           in: "body", type: "string",  required: true,  description: "Must match series unit_default" },
      { name: "region",         in: "body", type: "string",  required: false, description: "NGA for national (default)" },
      { name: "device_id",      in: "body", type: "string",  required: false, description: "EOM device identifier" },
      { name: "readings",       in: "body", type: "array",   required: false, description: "Array of readings for batch ingest" },
    ],
    example: `POST ${BASE}/api/iot/ingest\nX-API-Key: <your-key>\nContent-Type: application/json\n\n{\n  "series_type_id": "crude_oil_production",\n  "period": "2026-06",\n  "period_date": "2026-06-01",\n  "value": 85.4,\n  "unit": "M Barrels",\n  "region": "NGA"\n}`,
    response: `{ "inserted": 1, "series_type_id": "crude_oil_production" }`,
  },
  {
    method: "GET",
    path: "/api/health",
    description: "System health check. Returns database and cache connectivity status.",
    response: `{ "status": "ok", "db": "ok", "ts": "2026-06-30T10:00:00.000Z" }`,
  },
];

const METHOD_COLOR: Record<string, string> = {
  GET: "#0E7A3C", POST: "#1a56a4", PATCH: "#92400e", DELETE: "#991b1b",
};
const METHOD_BG: Record<string, string> = {
  GET: "#F0FDF4", POST: "#EFF6FF", PATCH: "#FFFBEB", DELETE: "#FEF2F2",
};

const SERIES_IDS = [
  "crude_oil_production", "natural_gas_production", "pms_sales", "ago_sales",
  "kerosine_sales", "lpg_sales", "electricity_generation", "electricity_sent_out",
  "electricity_consumption", "renewable_energy", "fuelwood_consumption", "faac_oil_revenue",
  "upstream_royalties",
];

export default function ApiDocsPage() {
  return (
    <>
      <Navbar />
      <div style={{ background: "var(--ink)", borderBottom: "3px solid var(--green)", padding: "3rem 0 2.5rem" }}>
        <div className="page-wrap">
          <div style={{ display: "inline-block", fontSize: "0.68rem", fontWeight: 700, color: "var(--green)", textTransform: "uppercase", letterSpacing: "0.1em", background: "rgba(14,122,60,0.15)", padding: "3px 10px", borderRadius: 4, marginBottom: "0.875rem" }}>REST API · v1</div>
          <h1 style={{ fontFamily: "var(--font-serif)", fontSize: "clamp(1.75rem,4vw,2.5rem)", color: "#fff", fontWeight: 400, lineHeight: 1.1, marginBottom: "0.75rem" }}>
            NEDB Public API
          </h1>
          <p style={{ fontSize: "0.9rem", color: "rgba(255,255,255,0.55)", maxWidth: 600, lineHeight: 1.6 }}>
            Free, open access to Nigeria's national energy statistics. No API key required for public endpoints.
            Base URL: <code style={{ fontFamily: "var(--font-mono)", color: "var(--green)", fontSize: "0.85rem" }}>{BASE}</code>
          </p>
        </div>
      </div>

      <main style={{ background: "var(--surface)", padding: "3rem 0 5rem" }}>
        <div className="page-wrap" style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: "3rem", alignItems: "start" }}>

          {/* Sidebar nav */}
          <nav style={{ position: "sticky", top: "1.5rem" }}>
            <div style={{ fontSize: "0.65rem", fontWeight: 700, color: "var(--ink-5)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "0.75rem" }}>Endpoints</div>
            {ENDPOINTS.map((ep) => (
              <a key={ep.path} href={`#${ep.path.replace(/[{}\/]/g, "-")}`} style={{ display: "flex", alignItems: "center", gap: 8, padding: "0.4rem 0", fontSize: "0.75rem", color: "var(--ink-4)", textDecoration: "none", borderBottom: "1px solid transparent" }}>
                <span style={{ fontSize: "0.6rem", fontWeight: 800, color: METHOD_COLOR[ep.method], background: METHOD_BG[ep.method], padding: "1px 5px", borderRadius: 3, flexShrink: 0 }}>{ep.method}</span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.68rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ep.path}</span>
              </a>
            ))}
            <div style={{ marginTop: "1.5rem", fontSize: "0.65rem", fontWeight: 700, color: "var(--ink-5)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "0.5rem" }}>Series IDs</div>
            {SERIES_IDS.map((id) => (
              <div key={id} style={{ fontFamily: "var(--font-mono)", fontSize: "0.62rem", color: "var(--green-deep)", padding: "2px 0", lineHeight: 1.6 }}>{id}</div>
            ))}
          </nav>

          {/* Endpoint docs */}
          <div style={{ display: "flex", flexDirection: "column", gap: "2.5rem" }}>
            {ENDPOINTS.map((ep) => (
              <section key={ep.path} id={ep.path.replace(/[{}\/]/g, "-")} style={{ background: "var(--surface-raised)", border: "1px solid var(--border)", borderRadius: "var(--r-lg)", overflow: "hidden" }}>
                {/* Header */}
                <div style={{ padding: "1.25rem 1.5rem", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
                  <span style={{ fontFamily: "var(--font-mono)", fontWeight: 800, fontSize: "0.75rem", color: METHOD_COLOR[ep.method], background: METHOD_BG[ep.method], padding: "3px 10px", borderRadius: 5, flexShrink: 0 }}>{ep.method}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.92rem", fontWeight: 600, color: "var(--ink)", marginBottom: 4 }}>{ep.path}</div>
                    <div style={{ fontSize: "0.82rem", color: "var(--ink-4)", lineHeight: 1.5 }}>{ep.description}</div>
                  </div>
                  {ep.auth && (
                    <span style={{ fontSize: "0.65rem", fontWeight: 700, color: "#92400e", background: "#FFFBEB", padding: "2px 8px", borderRadius: 4, border: "1px solid #FDE68A" }}>X-API-Key required</span>
                  )}
                </div>

                {/* Params */}
                {ep.params && ep.params.length > 0 && (
                  <div style={{ padding: "1rem 1.5rem", borderBottom: "1px solid var(--border)" }}>
                    <div style={{ fontSize: "0.65rem", fontWeight: 700, color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.75rem" }}>Parameters</div>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.78rem" }}>
                      <thead>
                        <tr style={{ borderBottom: "1px solid var(--border)" }}>
                          <th style={{ textAlign: "left", padding: "4px 8px 8px 0", color: "var(--ink-4)", fontWeight: 700, fontSize: "0.68rem", textTransform: "uppercase" }}>Name</th>
                          <th style={{ textAlign: "left", padding: "4px 8px 8px", color: "var(--ink-4)", fontWeight: 700, fontSize: "0.68rem", textTransform: "uppercase" }}>In</th>
                          <th style={{ textAlign: "left", padding: "4px 8px 8px", color: "var(--ink-4)", fontWeight: 700, fontSize: "0.68rem", textTransform: "uppercase" }}>Type</th>
                          <th style={{ textAlign: "left", padding: "4px 0 8px 8px", color: "var(--ink-4)", fontWeight: 700, fontSize: "0.68rem", textTransform: "uppercase" }}>Description</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ep.params.map((p) => (
                          <tr key={p.name} style={{ borderBottom: "1px solid var(--border)" }}>
                            <td style={{ padding: "6px 8px 6px 0", fontFamily: "var(--font-mono)", fontSize: "0.72rem", color: "var(--green-deep)", verticalAlign: "top" }}>
                              {p.name}{p.required && <span style={{ color: "#C0392B", marginLeft: 2 }}>*</span>}
                            </td>
                            <td style={{ padding: "6px 8px", fontSize: "0.72rem", color: "var(--ink-4)", verticalAlign: "top" }}>{p.in}</td>
                            <td style={{ padding: "6px 8px", fontFamily: "var(--font-mono)", fontSize: "0.68rem", color: "var(--ink-4)", verticalAlign: "top" }}>{p.type}</td>
                            <td style={{ padding: "6px 0 6px 8px", color: "var(--ink-4)", verticalAlign: "top" }}>{p.description}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Example */}
                {ep.example && (
                  <div style={{ padding: "1rem 1.5rem", borderBottom: ep.response ? "1px solid var(--border)" : "none", background: "var(--surface-muted)" }}>
                    <div style={{ fontSize: "0.65rem", fontWeight: 700, color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.5rem" }}>Example Request</div>
                    <pre style={{ margin: 0, fontSize: "0.72rem", fontFamily: "var(--font-mono)", color: "var(--ink-3)", lineHeight: 1.6, overflowX: "auto", whiteSpace: "pre-wrap" }}>{ep.example}</pre>
                  </div>
                )}

                {/* Response */}
                {ep.response && (
                  <div style={{ padding: "1rem 1.5rem", background: "#0A0A0A" }}>
                    <div style={{ fontSize: "0.65rem", fontWeight: 700, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.5rem" }}>Example Response</div>
                    <pre style={{ margin: 0, fontSize: "0.72rem", fontFamily: "var(--font-mono)", color: "#6ee7a0", lineHeight: 1.7, overflowX: "auto", whiteSpace: "pre-wrap" }}>{ep.response}</pre>
                  </div>
                )}
              </section>
            ))}

            {/* Rate limits + usage notes */}
            <section style={{ background: "var(--surface-raised)", border: "1px solid var(--border)", borderRadius: "var(--r-lg)", padding: "1.5rem" }}>
              <h2 style={{ fontSize: "1rem", fontWeight: 700, color: "var(--ink)", marginBottom: "1rem" }}>Usage & Rate Limits</h2>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "1rem" }}>
                {[
                  { label: "Authentication", value: "Public endpoints — no key required. IoT ingest requires X-API-Key header (contact ECN for device keys)." },
                  { label: "Rate limits",    value: "500 requests/minute per IP. Sustained scraping is rate-limited — use the export endpoint for bulk downloads." },
                  { label: "Data licence",   value: "Published under ECN Open Data Policy. Attribution required: cite NEDB (Energy Commission of Nigeria)." },
                  { label: "Data currency",  value: "Updated as Energy Commission staff commit new data. Each series page shows the last upload date." },
                  { label: "Format",         value: "All responses are JSON (UTF-8). Export endpoint returns CSV or XLSX. All dates are ISO 8601." },
                  { label: "Contact",        value: "For API access issues or data queries, contact ECN Data Management at data@energy.gov.ng" },
                ].map((item) => (
                  <div key={item.label}>
                    <div style={{ fontSize: "0.68rem", fontWeight: 700, color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>{item.label}</div>
                    <div style={{ fontSize: "0.78rem", color: "var(--ink-4)", lineHeight: 1.5 }}>{item.value}</div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
