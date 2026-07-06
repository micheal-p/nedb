// ── scripts/ocr-ingest.mjs ──────────────────────────────────────────────────
// OCR + ingest for the six scanned Act PDFs (no text layer). Gemini reads the
// PDF natively (inline base64) and transcribes it; the transcript is chunked,
// embedded and upserted into doc_chunks like the text-layer documents.
// Run from frontend/:  node scripts/ocr-ingest.mjs

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const KEY = process.env.GEMINI_API_KEY;
const SB_URL = process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!KEY || !SB_URL || !SB_KEY) { console.error("missing env"); process.exit(1); }

const DOCS = {
  "ecn_act.pdf": "Energy Commission of Nigeria Act (CAP. E10)",
  "Hydrocarbon_Oil_Refinery_Act.pdf": "Hydrocarbon Oil Refinery Act",
  "Nigerian_Atomic_Energy_Commission_Act.pdf": "Nigerian Atomic Energy Commission Act",
  "Nuclear_Safety_and_Radiation_Protection_Act.pdf": "Nuclear Safety and Radiation Protection Act",
  "Petroleum_Technology_Development_Fund_Act.pdf": "Petroleum Technology Development Fund Act",
  "Petroleum_Traning_Institute_Act.pdf": "Petroleum Training Institute Act",
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function withRetry(fn, label, tries = 5) {
  for (let a = 1; ; a++) {
    try { return await fn(); }
    catch (e) {
      if (a >= tries) throw e;
      const wait = e.message?.includes("429") ? 40000 * a : 3000 * a;
      console.warn(`  retry ${a} for ${label} in ${Math.round(wait / 1000)}s (${e.message?.slice(0, 60)})`);
      await sleep(wait);
    }
  }
}

async function geminiPdf(parts) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: { temperature: 0, maxOutputTokens: 65536, thinkingConfig: { thinkingBudget: 0 } },
      }),
    }
  );
  if (!res.ok) throw new Error(`gemini ${res.status}: ${(await res.text()).slice(0, 150)}`);
  const j = await res.json();
  return {
    text: j?.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "",
    finish: j?.candidates?.[0]?.finishReason ?? "STOP",
  };
}

async function transcribe(file) {
  const b64 = readFileSync(`public/documents/${file}`).toString("base64");
  const pdfPart = { inlineData: { mimeType: "application/pdf", data: b64 } };
  const basePrompt =
    "Transcribe the COMPLETE text of this scanned legal document, in reading order. " +
    "Output plain text only — no commentary, no markdown fences. Preserve section numbers and headings. " +
    "If a word is illegible, write [illegible].";

  let full = "";
  let { text, finish } = await withRetry(() => geminiPdf([pdfPart, { text: basePrompt }]), `${file} p1`);
  full += text;
  let cont = 0;
  while (finish === "MAX_TOKENS" && cont < 5) {
    cont++;
    await sleep(8000);
    const tail = full.slice(-300);
    const r = await withRetry(
      () => geminiPdf([pdfPart, { text: `${basePrompt}\n\nContinue the transcription EXACTLY from after this point (do not repeat it):\n...${tail}` }]),
      `${file} cont${cont}`
    );
    full += r.text;
    finish = r.finish;
  }
  return full.trim();
}

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
  if (!res.ok) throw new Error(`embed 429? ${res.status}: ${(await res.text()).slice(0, 100)}`);
  return (await res.json()).embeddings.map((e) => e.values);
}

async function sb(method, path, body) {
  const res = await fetch(`${SB_URL}/rest/v1/${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      apikey: SB_KEY,
      Authorization: `Bearer ${SB_KEY}`,
      Prefer: method === "POST" ? "resolution=merge-duplicates" : "return=minimal",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`supabase ${res.status}: ${(await res.text()).slice(0, 150)}`);
}

mkdirSync("scripts/transcripts", { recursive: true });
let total = 0;
for (const [file, title] of Object.entries(DOCS)) {
  console.log(`OCR: ${file}`);
  const text = await transcribe(file);
  writeFileSync(`scripts/transcripts/${file}.txt`, text);
  const chunks = chunkText(text);
  console.log(`  ${Math.round(text.length / 1000)}k chars → ${chunks.length} chunks`);
  if (chunks.length < 3) { console.warn(`  SKIP ${file}: transcription too short`); continue; }

  // remove any junk chunks stored from the failed pdf-parse pass
  await withRetry(() => sb("DELETE", `doc_chunks?source_file=eq.${encodeURIComponent(file)}`), `clear ${file}`);

  for (let i = 0; i < chunks.length; i += 60) {
    const batch = chunks.slice(i, i + 60);
    const vecs = await withRetry(() => embedBatch(batch), `embed ${file}@${i}`);
    const rows = batch.map((content, j) => ({
      doc_title: title, source_file: file, chunk_index: i + j, content,
      embedding: JSON.stringify(vecs[j]),
    }));
    for (let k = 0; k < rows.length; k += 30) {
      await withRetry(() => sb("POST", "doc_chunks?on_conflict=source_file,chunk_index", rows.slice(k, k + 30)), `insert ${file}@${i + k}`);
    }
    total += rows.length;
    await sleep(13000);
  }
  await sleep(8000);
}
console.log(`DONE — ${total} OCR chunks embedded and stored.`);
