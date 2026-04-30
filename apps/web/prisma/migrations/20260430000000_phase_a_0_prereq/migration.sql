-- Phase A.0.1 — Prerequisites for scoring fixes
--
-- 1. Persist `robotsTxtBlocks` on Content (today computed by fetcher.py and lost).
-- 2. Composite index on CitationCheck for fast Beta(α, β) trend queries.
--
-- Manual application required (see docs/_features/v2-azioni-manuali.md → A.0.1):
-- the application user does not have ALTER TABLE permissions; run via superuser.

ALTER TABLE "contents"
  ADD COLUMN IF NOT EXISTS "robotsTxtBlocks" TEXT[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS "citation_checks_projectId_targetQueryId_checkedAt_idx"
  ON "citation_checks" ("projectId", "targetQueryId", "checkedAt" DESC);
