-- ── 019: GraphRAG — pgvector document store for the AI policy assistant ──────
-- Chunks of the ECN legal/policy PDFs, embedded with Gemini text-embedding-004
-- (768 dims), searched by cosine similarity. Populated by scripts/ingest-docs.mjs.

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS doc_chunks (
  id          BIGSERIAL PRIMARY KEY,
  doc_title   TEXT NOT NULL,          -- "Petroleum Industry Act 2021"
  source_file TEXT NOT NULL,          -- "Petroleum_Industry_Act_2021.pdf"
  chunk_index INT  NOT NULL,
  content     TEXT NOT NULL,
  embedding   vector(768),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (source_file, chunk_index)
);

CREATE INDEX IF NOT EXISTS idx_doc_chunks_embedding
  ON doc_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 50);

ALTER TABLE doc_chunks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_doc_chunks" ON doc_chunks USING (true) WITH CHECK (true);

-- Similarity search RPC used by /api/ask
CREATE OR REPLACE FUNCTION match_doc_chunks(
  query_embedding vector(768),
  match_count int DEFAULT 6
)
RETURNS TABLE (id bigint, doc_title text, source_file text, content text, similarity float)
LANGUAGE sql STABLE AS $$
  SELECT
    dc.id, dc.doc_title, dc.source_file, dc.content,
    1 - (dc.embedding <=> query_embedding) AS similarity
  FROM doc_chunks dc
  WHERE dc.embedding IS NOT NULL
  ORDER BY dc.embedding <=> query_embedding
  LIMIT match_count;
$$;
