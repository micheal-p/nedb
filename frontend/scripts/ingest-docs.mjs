// ── scripts/ingest-docs.mjs ─────────────────────────────────────────────────
// One-time GraphRAG ingestion: extracts text from the PDFs in public/documents,
// chunks it, embeds each chunk with Gemini text-embedding-004 (batched), and
// upserts into doc_chunks. Run from frontend/:
//   node scripts/ingest-docs.mjs
// Requires GEMINI_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY in .env.local

import { readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { PDFParse } = require("pdf-parse"); // v2.x class API

async function extractText(buf) {
  const parser = new PDFParse({ data: new Uint8Array(buf) });
  try {
    const result = await parser.getText();
    if (typeof result?.text === "string" && result.text.trim()) return result.text;
    if (Array.isArray(result?.pages)) return result.pages.map((p) => p.text ?? "").join("\n");
    throw new Error("no text extracted");
  } finally {
    await parser.destroy?.();
  }
}

// minimal .env.local loader
for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}

const KEY = process.env.GEMINI_API_KEY;
const SB_URL = process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!KEY || !SB_URL || !SB_KEY) {
  console.error("Missing GEMINI_API_KEY / SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const TITLES = {
  "Petroleum_Industry_Act_2021.pdf": "Petroleum Industry Act 2021",
  "ecn_act.pdf": "Energy Commission of Nigeria Act (CAP. E10)",
  "Energy_Policy_Document.pdf": "National Energy Policy",
  "Hydrocarbon_Oil_Refinery_Act.pdf": "Hydrocarbon Oil Refinery Act",
  "Nigerian_Atomic_Energy_Commission_Act.pdf": "Nigerian Atomic Energy Commission Act",
  "Nuclear_Safety_and_Radiation_Protection_Act.pdf": "Nuclear Safety and Radiation Protection Act",
  "Petroleum_Technology_Development_Fund_Act.pdf": "Petroleum Technology Development Fund Act",
  "Petroleum_Traning_Institute_Act.pdf": "Petroleum Training Institute Act",
};

function chunkText(text, size = 1400, overlap = 150) {
  const clean = text.replace(/\s+/g, " ").trim();
  const out = [];
  for (let i = 0; i < clean.length; i += size - overlap) {
    const c = clean.slice(i, i + size).trim();
    if (c.length > 200) out.push(c);
  }
  return out;
}

async function embedBatch(texts) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:batchEmbedContents?key=${KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requests: texts.map((t) => ({
          model: "models/gemini-embedding-001", outputDimensionality: 768,
          content: { parts: [{ text: t }] },
        })),
      }),
    }
  );
  if (!res.ok) throw new Error(`embed batch ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const j = await res.json();
  return j.embeddings.map((e) => e.values);
}

async function sbInsert(rows) {
  const res = await fetch(`${SB_URL}/rest/v1/doc_chunks?on_conflict=source_file,chunk_index`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SB_KEY,
      Authorization: `Bearer ${SB_KEY}`,
      Prefer: "resolution=merge-duplicates",
    },
    body: JSON.stringify(rows),
  });
  if (!res.ok) throw new Error(`supabase insert ${res.status}: ${(await res.text()).slice(0, 300)}`);
}

const files = readdirSync("public/documents").filter((f) => f.endsWith(".pdf"));
let total = 0;
for (const file of files) {
  const buf = readFileSync(`public/documents/${file}`);
  let text = "";
  try {
    text = await extractText(buf);
  } catch (e) {
    console.warn(`SKIP ${file}: ${e.message}`);
    continue;
  }
  const chunks = chunkText(text);
  console.log(`${file}: ${Math.round(text.length / 1000)}k chars → ${chunks.length} chunks`);

  for (let i = 0; i < chunks.length; i += 90) {
    const batch = chunks.slice(i, i + 90);
    const vecs = await embedBatch(batch);
    const rows = batch.map((content, j) => ({
      doc_title: TITLES[file] ?? file.replace(/_/g, " ").replace(".pdf", ""),
      source_file: file,
      chunk_index: i + j,
      content,
      embedding: JSON.stringify(vecs[j]),
    }));
    await sbInsert(rows);
    total += rows.length;
    process.stdout.write(`  upserted ${i + batch.length}/${chunks.length}\r`);
    await new Promise((r) => setTimeout(r, 500)); // stay well under free-tier rate limits
  }
  console.log("");
}
console.log(`DONE — ${total} chunks embedded and stored.`);
