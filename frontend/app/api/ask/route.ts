import { NextRequest } from "next/server";
import { db } from "@/lib/supabase-server";
import { ok, err } from "@/lib/api-helpers";
import { checkRateLimit } from "@/lib/rate-limit";
import { geminiConfigured, geminiEmbed, geminiGenerate } from "@/lib/gemini";

// POST /api/ask — GraphRAG policy assistant.
// Grounding = (a) top document chunks by pgvector cosine similarity over the
// ECN legal/policy PDFs, (b) live facts from the Energy Knowledge Graph.
// The model is instructed to answer ONLY from that context, with citations.

export async function POST(req: NextRequest) {
  if (!geminiConfigured()) {
    return err("Assistant not configured — set GEMINI_API_KEY", 503);
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0] ?? "anon";
  const rl = checkRateLimit(`ask:${ip}`, 10, 60_000);
  if (!rl.allowed) return err(`Rate limited — retry in ${rl.resetIn}s`, 429);

  const body = await req.json().catch(() => null);
  const question = (body?.question ?? "").toString().trim().slice(0, 500);
  if (!question) return err("question is required", 400);

  try {
    // 1. Retrieve relevant document chunks
    const qEmbedding = await geminiEmbed(question);
    let chunks: { doc_title: string; source_file: string; content: string; similarity: number }[] = [];
    if (qEmbedding) {
      const { data } = await db().rpc("match_doc_chunks", {
        query_embedding: qEmbedding,
        match_count: 6,
      });
      // Drop weakly-related chunks — graph-only questions (e.g. DisCo coverage)
      // shouldn't carry misleading document citations.
      chunks = (data ?? []).filter((c: { similarity: number }) => c.similarity >= 0.55);
    }

    // 2. Pull knowledge-graph facts (compact — the graph is small)
    const [{ data: nodes }, { data: edges }] = await Promise.all([
      db().from("graph_nodes").select("node_key, label, node_type, meta"),
      db().from("graph_edges").select("source_key, target_key, edge_type, weight"),
    ]);
    const labelOf = new Map((nodes ?? []).map((n) => [n.node_key, n.label]));
    const graphFacts = (edges ?? [])
      .map((e) => `${labelOf.get(e.source_key)} —${e.edge_type}→ ${labelOf.get(e.target_key)}${Number(e.weight) > 1 ? ` (${e.weight} MW)` : ""}`)
      .join("\n");
    const nodeFacts = (nodes ?? [])
      .filter((n) => (n.meta as Record<string, unknown>)?.description)
      .map((n) => `${n.label}: ${(n.meta as Record<string, unknown>).description}`)
      .join("\n");

    // 3. Grounded generation
    const context = [
      chunks.length
        ? "DOCUMENT EXCERPTS:\n" + chunks.map((c, i) => `[${i + 1}] (${c.doc_title})\n${c.content}`).join("\n---\n")
        : "DOCUMENT EXCERPTS: none ingested yet.",
      "ENERGY KNOWLEDGE GRAPH — ENTITY NOTES:\n" + nodeFacts,
      "ENERGY KNOWLEDGE GRAPH — RELATIONSHIPS:\n" + graphFacts,
    ].join("\n\n");

    const prompt = `You are the NEDB Policy & Research Assistant for the Energy Commission of Nigeria.
Answer the question using ONLY the context below. If the context does not contain the answer, say so plainly — never invent facts, figures or section numbers.
Cite document excerpts as [1], [2] etc. and keep the answer under 200 words, in clear plain English.

CONTEXT:
${context}

QUESTION: ${question}`;

    const answer = await geminiGenerate(prompt);
    if (!answer) return err("No answer generated", 502);

    return ok({
      answer,
      sources: chunks.map((c, i) => ({
        n: i + 1,
        doc: c.doc_title,
        file: c.source_file,
        similarity: Math.round(c.similarity * 100) / 100,
      })),
      grounded_on: { chunks: chunks.length, graph_nodes: (nodes ?? []).length },
    });
  } catch (e) {
    return err(e instanceof Error ? e.message : "Assistant error", 500);
  }
}
