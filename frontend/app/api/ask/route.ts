import { NextRequest } from "next/server";
import { db } from "@/lib/supabase-server";
import { ok, err, requireAuth } from "@/lib/api-helpers";
import { checkRateLimitDurable } from "@/lib/rate-limit";
import { geminiConfigured, geminiEmbed, geminiGenerate } from "@/lib/gemini";
import { getGeminiUsage, quotaResetISO } from "@/lib/usage";

// POST /api/ask — GraphRAG policy assistant.
// Grounding = (a) top document chunks by pgvector cosine similarity over the
// ECN legal/policy PDFs, (b) live facts from the Energy Knowledge Graph.
// The model is instructed to answer ONLY from that context, with citations.

export async function POST(req: NextRequest) {
  if (!geminiConfigured()) {
    return err("Assistant not configured — set GEMINI_API_KEY", 503);
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anon";
  const started = Date.now();
  const log = (question: string, status: string, sources = 0) => {
    // fire-and-forget admin telemetry — must never affect the response
    db().from("ask_logs").insert({
      ip, question: question.slice(0, 300), status, sources,
      duration_ms: Date.now() - started,
    }).then(() => {}, () => {});
  };
  // Authenticated Data Point staff get a much higher ceiling (keyed by account,
  // not IP); the public 10/min guard applies to anonymous visitors only.
  const auth = await requireAuth(req);
  const rl = auth
    ? await checkRateLimitDurable(`ask:user:${(auth as { username?: string }).username ?? "staff"}`, 60, 60)
    : await checkRateLimitDurable(`ask:${ip}`, 10, 60);
  if (!rl.allowed) {
    return Response.json(
      { error: "chat_rate_limit", resetIn: rl.resetIn, message: `You're asking quickly — you can ask again in ${rl.resetIn}s.` },
      { status: 429 }
    );
  }

  const body = await req.json().catch(() => null);
  const question = (body?.question ?? "").toString().trim().slice(0, 500);
  if (!question) return err("question is required", 400);
  // What the user is currently looking at (view name, visible KPI values…)
  const screen = (body?.context ?? "").toString().trim().slice(0, 700);

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
      screen ? "WHAT THE USER IS CURRENTLY VIEWING ON SCREEN:\n" + screen : "",
    ].filter(Boolean).join("\n\n");

    const prompt = `You are the NEDB Policy & Research Assistant for the Energy Commission of Nigeria.
Answer primarily from the context below, in clear plain English.
Do NOT include bracketed citation markers like [1] or [2] in your answer — the interface lists the source documents separately.
If the question is a GENERAL definition or concept (an energy term, a statistical method, an acronym) that the context does not cover, you may give a brief standard definition without a citation.
If the user refers to "this page", "this chart" or "what I'm seeing", use the WHAT THE USER IS CURRENTLY VIEWING section.
But NEVER invent Nigeria-specific facts: names, appointments, figures, dates, locations or section numbers must come from the context — if they are not there, say so plainly.
Keep the answer under 200 words, in clear plain English.

CONTEXT:
${context}

QUESTION: ${question}`;

    const answer = await geminiGenerate(prompt);
    if (!answer) { log(question, "error"); return err("No answer generated", 502); }

    log(question, "ok", chunks.length);
    return ok({
      answer,
      sources: chunks.map((c, i) => ({
        n: i + 1,
        doc: c.doc_title,
        file: c.source_file,
        similarity: Math.round(c.similarity * 100) / 100,
      })),
      grounded_on: { chunks: chunks.length, graph_nodes: (nodes ?? []).length },
      usage: {
        chat: { remaining: rl.remaining, resetIn: rl.resetIn },       // our 10/min limit
        ai: await getGeminiUsage(),                                    // self-metered daily Gemini usage
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Assistant error";
    // Gemini free-tier quota exhausted → tell the user exactly when it resets
    if (/429/.test(msg)) {
      log(question, "ai_quota");
      return Response.json(
        { error: "ai_quota", resetsAt: quotaResetISO(), message: "Today's free AI allowance is used up." },
        { status: 429 }
      );
    }
    log(question, "error");
    return err(msg, 500);
  }
}
