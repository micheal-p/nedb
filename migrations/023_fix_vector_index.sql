-- ── 023: Fix document retrieval — drop the mistrained ivfflat index ──────────
-- The ivfflat index in 019 was created on an EMPTY table, so its cluster
-- centroids are meaningless and approximate search misses obvious matches
-- (e.g. a 0.64-similarity chunk not appearing in the top 8). At ~700 rows an
-- exact scan is instant; recreate an index only if the corpus passes ~50k rows
-- (and build it AFTER the data is loaded).

DROP INDEX IF EXISTS idx_doc_chunks_embedding;
