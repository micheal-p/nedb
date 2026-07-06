// ── scripts/ingest-kb.mjs ───────────────────────────────────────────────────
// Ingests curated markdown knowledge files (scripts/kb/*.md) into doc_chunks.
// Chunks by section (## headings) so each fact stays intact and retrievable.
// Idempotent: deletes each file's previous chunks before re-inserting.
// Run from frontend/:  node scripts/ingest-kb.mjs

import { readFileSync, readdirSync } from "node:fs";

for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const KEY = process.env.GEMINI_API_KEY;
const SB_URL = process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!KEY || !SB_URL || !SB_KEY) { console.error("missing env"); process.exit(1); }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function withRetry(fn, label, tries = 5) {
  for (let a = 1; ; a++) {
    try { return await fn(); }
    catch (e) {
      if (a >= tries) throw e;
      const wait = e.message?.includes("429") ? 40000 * a : 3000 * a;
      console.warn(`  retry ${a} for ${label} in ${Math.round(wait / 1000)}s`);
      await sleep(wait);
    }
  }
}

// Section-aware chunking: split on ## headings; further split any huge section.
function chunkMarkdown(md) {
  const sections = md.split(/\n(?=## )/g).map((s) => s.replace(/\s+/g, " ").trim()).filter((s) => s.length > 80);
  const out = [];
  for (const s of sections) {
    if (s.length <= 1600) out.push(s);
    else for (let i = 0; i < s.length; i += 1400) out.push(s.slice(i, i + 1600));
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
          model: "models/gemini-embedding-001", outputDimensionality: 768, taskType: "RETRIEVAL_DOCUMENT",
          content: { parts: [{ text: t }] },
        })),
      }),
    }
  );
  if (!res.ok) throw new Error(`embed ${res.status}`);
  return (await res.json()).embeddings.map((e) => e.values);
}

async function sb(method, path, body) {
  const res = await fetch(`${SB_URL}/rest/v1/${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`,
      Prefer: method === "POST" ? "resolution=merge-duplicates" : "return=minimal",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`supabase ${res.status}: ${(await res.text()).slice(0, 150)}`);
}

let total = 0;
for (const file of readdirSync("scripts/kb").filter((f) => f.endsWith(".md"))) {
  const chunks = chunkMarkdown(readFileSync(`scripts/kb/${file}`, "utf8"));
  console.log(`${file}: ${chunks.length} section chunks`);
  await withRetry(() => sb("DELETE", `doc_chunks?source_file=eq.${encodeURIComponent(file)}`), `clear ${file}`);
  const vecs = await withRetry(() => embedBatch(chunks), `embed ${file}`);
  const rows = chunks.map((content, i) => ({
    doc_title: "NEDB Reference Notes & Glossary",
    source_file: file, chunk_index: i, content,
    embedding: JSON.stringify(vecs[i]),
  }));
  for (let k = 0; k < rows.length; k += 30) {
    await withRetry(() => sb("POST", "doc_chunks?on_conflict=source_file,chunk_index", rows.slice(k, k + 30)), `insert ${file}@${k}`);
  }
  total += rows.length;
}
console.log(`DONE — ${total} reference chunks stored.`);
