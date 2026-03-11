-- Add vector(1024) columns for embedding storage (pgvector)
-- Prisma does not natively support the vector type, so these are managed
-- via raw SQL migrations. Dimension 1024 matches Voyage AI voyage-3-large.

ALTER TABLE "fanout_queries"
  ADD COLUMN IF NOT EXISTS "embedding" vector(1024);

ALTER TABLE "passages"
  ADD COLUMN IF NOT EXISTS "embedding" vector(1024);

ALTER TABLE "competitor_passages"
  ADD COLUMN IF NOT EXISTS "embedding" vector(1024);

-- IVFFlat indexes for approximate nearest-neighbour search
-- (created after data is loaded — these are omitted at init time to
--  avoid errors on empty tables with no lists to build)
-- Run manually after first batch of embeddings:
-- CREATE INDEX ON fanout_queries USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
-- CREATE INDEX ON passages USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
-- CREATE INDEX ON competitor_passages USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
