import type { EnergyRecord } from "@/lib/api";

interface Props {
  records: EnergyRecord[];
  unit: string;
  total: number;
}

export default function SeriesTable({ records, unit, total }: Props) {
  return (
    <div>
      <div style={{ padding: "0.75rem 1.25rem", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--surface-muted)" }}>
        <span style={{ fontSize: "0.75rem", color: "var(--ink-4)" }}>
          Showing <strong style={{ color: "var(--ink)" }}>{records.length.toLocaleString()}</strong> of{" "}
          <strong style={{ color: "var(--ink)" }}>{total.toLocaleString()}</strong> records
        </span>
        <span style={{ fontSize: "0.72rem", color: "var(--ink-5)", fontFamily: "var(--font-mono)" }}>
          Unit: {unit}
        </span>
      </div>

      <table className="data-table">
        <thead>
          <tr>
            <th style={{ width: 44 }}>#</th>
            <th>Period</th>
            <th>Region</th>
            <th style={{ textAlign: "right" }}>Value</th>
            <th>Unit</th>
            <th>Data Source</th>
            <th>Notes</th>
          </tr>
        </thead>
        <tbody>
          {records.map((r, i) => (
            <tr key={r.id}>
              <td style={{ color: "var(--ink-5)", fontSize: "0.72rem" }}>{i + 1}</td>
              <td className="td-mono td-primary">{r.period}</td>
              <td>{r.region}</td>
              <td className="td-num">
                {r.value != null ? Number(r.value).toLocaleString() : "—"}
              </td>
              <td style={{ fontSize: "0.78rem", color: "var(--ink-4)" }}>{r.unit}</td>
              <td style={{ fontSize: "0.78rem", color: "var(--ink-4)" }}>{r.source ?? "—"}</td>
              <td style={{ fontSize: "0.78rem", color: "var(--ink-5)", maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {r.notes ?? "—"}
              </td>
            </tr>
          ))}
          {records.length === 0 && (
            <tr>
              <td colSpan={7} style={{ textAlign: "center", padding: "3rem", color: "var(--ink-4)", fontSize: "0.82rem" }}>
                No records. Upload a dataset to populate this series.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
