interface Agency { name: string; color: string; }

interface Props {
  title: string;
  caption: string;
  agencies: Agency[];
  rowsPreview?: { label: string; value: string }[];
}

export default function FiscalShellPanel({ title, caption, agencies, rowsPreview }: Props) {
  const ghostRows = rowsPreview ?? [
    { label: "Primary metric", value: "—" },
    { label: "Secondary metric", value: "—" },
    { label: "Variance", value: "—" },
    { label: "Year-to-date", value: "—" },
  ];

  return (
    <div className="coming-soon-panel">
      {/* Ghost layout under overlay */}
      <div className="coming-soon-ghost" style={{ padding: "1.5rem" }}>
        <div style={{ display: "flex", gap: "1rem", marginBottom: "1rem" }}>
          <div className="ghost-bar" style={{ width: "45%", height: 10 }} />
          <div className="ghost-bar" style={{ width: "25%", height: 10 }} />
        </div>
        {ghostRows.map((_, i) => (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
            <div className="ghost-bar" style={{ width: "40%", height: 8 }} />
            <div className="ghost-bar" style={{ width: "20%", height: 8 }} />
          </div>
        ))}
        <div style={{ height: 80, background: "var(--border)", borderRadius: 6, marginTop: 16 }} />
      </div>

      {/* Coming Soon overlay */}
      <div className="coming-soon-overlay">
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "center", marginBottom: 4 }}>
          {agencies.map((a) => (
            <span
              key={a.name}
              style={{
                fontSize: "0.65rem", fontWeight: 700, padding: "2px 8px",
                borderRadius: 4, background: a.color + "18", color: a.color,
                border: `1px solid ${a.color}30`, letterSpacing: "0.04em",
              }}
            >
              {a.name}
            </span>
          ))}
        </div>
        <span className="badge badge-amber" style={{ fontSize: "0.65rem" }}>Coming Soon</span>
        <h4>{title}</h4>
        <p>{caption}</p>
      </div>
    </div>
  );
}
