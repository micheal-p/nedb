// ── lib/graph-excel.ts ──────────────────────────────────────────────────────
// Client-only. Excel export for the Energy Knowledge Graph, mirroring the layout
// discipline of excel-export.ts (same header colours, alternating rows, frozen
// header rows). Sheets:
//   1. Overview      — letterhead, network KPIs, embedded graph PNG
//   2. Centrality    — full degree-centrality ranking
//   3. Relationships — every edge with readable labels
//   4. Notes         — methodology and citation
// ExcelJS is dynamically imported so it never enters the main bundle.

import {
  NODE_STYLE, EDGE_LABEL,
  type GraphData, type Centrality, type NodeType, type EdgeType,
} from "@/lib/graph-model";

const GREEN = "FF0E7A3C";
const INK = "FF0A0A0A";
const HEADER_BG = "FF0E7A3C";
const ALT_BG = "FFF4F2EC";
const RED = "FFC0392B";

interface GraphExcelInput {
  graph: GraphData;
  centrality: Centrality[];
  singlePointsOfFailure: string[];
  graphPng: string | null;
}

export async function exportGraphXlsx({ graph, centrality, singlePointsOfFailure, graphPng }: GraphExcelInput) {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = "NEDB — Energy Commission of Nigeria";
  wb.created = new Date();

  const labelByKey = new Map(graph.nodes.map((n) => [n.key, n.label]));
  const typeByKey = new Map(graph.nodes.map((n) => [n.key, n.type]));
  const spofSet = new Set(singlePointsOfFailure);

  // ── Sheet 1: Overview ──────────────────────────────────────────────────────
  const ov = wb.addWorksheet("Overview", { views: [{ showGridLines: false }] });
  ov.columns = [{ width: 30 }, { width: 22 }, { width: 22 }, { width: 22 }, { width: 22 }];

  ov.mergeCells("A1:E1");
  ov.getCell("A1").value = "ENERGY COMMISSION OF NIGERIA — National Energy Data Bank";
  ov.getCell("A1").font = { bold: true, size: 13, color: { argb: GREEN } };

  ov.mergeCells("A2:E2");
  ov.getCell("A2").value = "National Energy Knowledge Graph";
  ov.getCell("A2").font = { bold: true, size: 16, color: { argb: INK } };

  ov.mergeCells("A3:E3");
  ov.getCell("A3").value = `Generated ${new Date().toLocaleString("en-NG")} · Built in-house on NEDB PostgreSQL — no external graph-database subscription`;
  ov.getCell("A3").font = { size: 10, color: { argb: "FF5C5650" } };

  let r = 5;
  ov.getCell(`A${r}`).value = "NETWORK SUMMARY";
  ov.getCell(`A${r}`).font = { bold: true, size: 11, color: { argb: INK } };
  r++;

  const typeCounts = new Map<NodeType, number>();
  for (const n of graph.nodes) typeCounts.set(n.type, (typeCounts.get(n.type) ?? 0) + 1);

  const summaryRows: [string, string][] = [
    ["Entities (nodes)", String(graph.nodes.length)],
    ["Relationships (edges)", String(graph.edges.length)],
    ["Single points of failure", singlePointsOfFailure.map((k) => labelByKey.get(k) ?? k).join(", ") || "None detected"],
    ...([...typeCounts.entries()].map(([t, n]) => [`— ${NODE_STYLE[t].label}`, String(n)] as [string, string])),
  ];
  for (const [label, val] of summaryRows) {
    ov.getCell(`A${r}`).value = label;
    ov.getCell(`A${r}`).font = { color: { argb: "FF5C5650" }, size: 10 };
    ov.mergeCells(`B${r}:E${r}`);
    ov.getCell(`B${r}`).value = val;
    ov.getCell(`B${r}`).font = { bold: true, color: { argb: INK }, size: 10 };
    r++;
  }

  if (graphPng) {
    r++;
    ov.getCell(`A${r}`).value = "NETWORK VISUALISATION";
    ov.getCell(`A${r}`).font = { bold: true, size: 11, color: { argb: INK } };
    const imgId = wb.addImage({ base64: graphPng, extension: "png" });
    ov.addImage(imgId, { tl: { col: 0, row: r }, ext: { width: 640, height: 420 } });
  }

  // ── Sheet 2: Centrality ────────────────────────────────────────────────────
  const ce = wb.addWorksheet("Centrality", { views: [{ state: "frozen", ySplit: 1 }] });
  ce.columns = [
    { header: "Rank", width: 8 },
    { header: "Entity", width: 34 },
    { header: "Type", width: 24 },
    { header: "Connections", width: 14 },
    { header: "Inbound", width: 12 },
    { header: "Outbound", width: 12 },
    { header: "Critical Node", width: 14 },
  ];
  styleHeader(ce.getRow(1));
  centrality.forEach((c, i) => {
    const row = ce.addRow([
      i + 1, c.label, NODE_STYLE[c.type].label, c.degree, c.inDeg, c.outDeg,
      spofSet.has(c.key) ? "YES" : "",
    ]);
    if (i % 2 === 1) fillRow(row, ALT_BG);
    if (spofSet.has(c.key)) row.getCell(7).font = { bold: true, color: { argb: RED }, size: 10 };
  });

  // ── Sheet 3: Relationships ─────────────────────────────────────────────────
  const re = wb.addWorksheet("Relationships", { views: [{ state: "frozen", ySplit: 1 }] });
  re.columns = [
    { header: "From", width: 32 },
    { header: "Relationship", width: 18 },
    { header: "To", width: 32 },
    { header: "From Type", width: 22 },
    { header: "To Type", width: 22 },
    { header: "Weight (MW / share)", width: 18 },
  ];
  styleHeader(re.getRow(1));
  graph.edges.forEach((e, i) => {
    const row = re.addRow([
      labelByKey.get(e.source) ?? e.source,
      EDGE_LABEL[e.type as EdgeType] ?? e.type,
      labelByKey.get(e.target) ?? e.target,
      NODE_STYLE[(typeByKey.get(e.source) ?? "state") as NodeType].label,
      NODE_STYLE[(typeByKey.get(e.target) ?? "state") as NodeType].label,
      e.weight ?? 1,
    ]);
    if (i % 2 === 1) fillRow(row, ALT_BG);
  });

  // ── Sheet 4: Notes ─────────────────────────────────────────────────────────
  const notes = wb.addWorksheet("Notes");
  notes.columns = [{ width: 110 }];
  const noteLines = [
    "National Energy Knowledge Graph — methodology notes",
    "",
    "Entities and relationships are stored as a property graph (graph_nodes / graph_edges) in NEDB's PostgreSQL database.",
    "Degree centrality counts a node's total inbound + outbound relationships; the most connected entities are the most systemically important.",
    "Single points of failure are computed with an articulation-point algorithm: nodes whose removal would disconnect part of the energy network.",
    "Downstream impact traces use breadth-first traversal over directed relationships (fuel supply → generation → wheeling → distribution).",
    "",
    `Cite as: ECN-NEDB, ${new Date().getFullYear()}.`,
  ];
  noteLines.forEach((line, i) => {
    notes.getCell(`A${i + 1}`).value = line;
    if (i === 0) notes.getCell("A1").font = { bold: true, size: 12, color: { argb: INK } };
  });

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "NEDB_energy_knowledge_graph.xlsx";
  a.click();
  URL.revokeObjectURL(url);
}

// ── shared row styling ────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function styleHeader(row: any) {
  row.eachCell((cell: { font: unknown; fill: unknown; alignment: unknown }) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_BG } };
    cell.alignment = { vertical: "middle", horizontal: "center" };
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function fillRow(row: any, argb: string) {
  row.eachCell((cell: { fill: unknown }) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb } };
  });
}
