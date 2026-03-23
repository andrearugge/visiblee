-- Scoring Engine v2 Migration
-- Uses RENAME COLUMN (not drop+create) to preserve existing data.

-- ─── 1. ProjectScoreSnapshot — rename score columns ───────────────────────────
ALTER TABLE "project_score_snapshots" RENAME COLUMN "passageQualityScore"  TO "citationPowerScore";
ALTER TABLE "project_score_snapshots" RENAME COLUMN "entityCoherenceScore" TO "entityAuthorityScore";
ALTER TABLE "project_score_snapshots" RENAME COLUMN "chunkabilityScore"    TO "extractabilityScore";
ALTER TABLE "project_score_snapshots" RENAME COLUMN "crossPlatformScore"   TO "sourceAuthorityScore";

-- ─── 2. PreviewAnalysis — rename score columns ────────────────────────────────
ALTER TABLE "preview_analyses" RENAME COLUMN "passageQualityScore"  TO "citationPowerScore";
ALTER TABLE "preview_analyses" RENAME COLUMN "entityCoherenceScore" TO "entityAuthorityScore";
ALTER TABLE "preview_analyses" RENAME COLUMN "chunkabilityScore"    TO "extractabilityScore";
ALTER TABLE "preview_analyses" RENAME COLUMN "crossPlatformScore"   TO "sourceAuthorityScore";

-- ─── 3. ContentScore — rename score columns ───────────────────────────────────
ALTER TABLE "content_scores" RENAME COLUMN "passageQualityScore" TO "citationPowerScore";
ALTER TABLE "content_scores" RENAME COLUMN "chunkabilityScore"   TO "extractabilityScore";

-- ─── 4. PassageScore — replace old sub-criteria with new heuristic fields ─────
ALTER TABLE "passage_scores" DROP COLUMN IF EXISTS "selfContainedness";
ALTER TABLE "passage_scores" DROP COLUMN IF EXISTS "claimClarity";
ALTER TABLE "passage_scores" DROP COLUMN IF EXISTS "informationDensity";
ALTER TABLE "passage_scores" DROP COLUMN IF EXISTS "completeness";
ALTER TABLE "passage_scores" DROP COLUMN IF EXISTS "verifiability";
ALTER TABLE "passage_scores" ADD COLUMN "positionScore"          DOUBLE PRECISION;
ALTER TABLE "passage_scores" ADD COLUMN "entityDensity"          DOUBLE PRECISION;
ALTER TABLE "passage_scores" ADD COLUMN "statisticalSpecificity" DOUBLE PRECISION;
ALTER TABLE "passage_scores" ADD COLUMN "definiteness"           DOUBLE PRECISION;
ALTER TABLE "passage_scores" ADD COLUMN "answerFirst"            DOUBLE PRECISION;
ALTER TABLE "passage_scores" ADD COLUMN "sourceCitation"         DOUBLE PRECISION;

-- ─── 5. Content — new fields ──────────────────────────────────────────────────
ALTER TABLE "contents" ADD COLUMN "rawHtml"            TEXT;
ALTER TABLE "contents" ADD COLUMN "schemaMarkup"       JSONB;
ALTER TABLE "contents" ADD COLUMN "hasArticleSchema"   BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "contents" ADD COLUMN "hasFaqSchema"       BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "contents" ADD COLUMN "hasOrgSchema"       BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "contents" ADD COLUMN "dateModifiedSchema" TIMESTAMP(3);
ALTER TABLE "contents" ADD COLUMN "lastContentHash"    TEXT;

-- ─── 6. Passage — new heuristic signal fields ─────────────────────────────────
ALTER TABLE "passages" ADD COLUMN "relativePosition"   DOUBLE PRECISION;
ALTER TABLE "passages" ADD COLUMN "entityDensity"      DOUBLE PRECISION;
ALTER TABLE "passages" ADD COLUMN "hasStatistics"      BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "passages" ADD COLUMN "hasSourceCitation"  BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "passages" ADD COLUMN "isAnswerFirst"      BOOLEAN NOT NULL DEFAULT false;

-- ─── 7. FanoutCoverageMap — add tier field ────────────────────────────────────
ALTER TABLE "fanout_coverage_map" ADD COLUMN "coverageTier" TEXT;

-- ─── 8. Project — new fields ──────────────────────────────────────────────────
ALTER TABLE "projects" ADD COLUMN "optimizationFocus" TEXT;
ALTER TABLE "projects" ADD COLUMN "aiPlatformTarget"  TEXT NOT NULL DEFAULT 'all';

-- ─── 9. Recommendation — new field ───────────────────────────────────────────
ALTER TABLE "recommendations" ADD COLUMN "sprintGroup" TEXT;

-- ─── 10. New table: CitationCheck ─────────────────────────────────────────────
CREATE TABLE "citation_checks" (
    "id"            TEXT    NOT NULL,
    "projectId"     TEXT    NOT NULL,
    "targetQueryId" TEXT    NOT NULL,
    "snapshotId"    TEXT,
    "citedSources"  JSONB   NOT NULL,
    "userCited"     BOOLEAN NOT NULL DEFAULT false,
    "searchQueries" JSONB,
    "rawResponse"   TEXT,
    "checkedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "citation_checks_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "citation_checks_projectId_idx"     ON "citation_checks"("projectId");
CREATE INDEX "citation_checks_targetQueryId_idx" ON "citation_checks"("targetQueryId");

ALTER TABLE "citation_checks"
    ADD CONSTRAINT "citation_checks_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "citation_checks"
    ADD CONSTRAINT "citation_checks_targetQueryId_fkey"
    FOREIGN KEY ("targetQueryId") REFERENCES "target_queries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "citation_checks"
    ADD CONSTRAINT "citation_checks_snapshotId_fkey"
    FOREIGN KEY ("snapshotId") REFERENCES "project_score_snapshots"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ─── 11. New table: ContentVersion ────────────────────────────────────────────
CREATE TABLE "content_versions" (
    "id"          TEXT NOT NULL,
    "contentId"   TEXT NOT NULL,
    "snapshotId"  TEXT NOT NULL,
    "passageData" JSONB NOT NULL,
    "contentHash" TEXT NOT NULL,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "content_versions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "content_versions_contentId_idx" ON "content_versions"("contentId");

ALTER TABLE "content_versions"
    ADD CONSTRAINT "content_versions_contentId_fkey"
    FOREIGN KEY ("contentId") REFERENCES "contents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "content_versions"
    ADD CONSTRAINT "content_versions_snapshotId_fkey"
    FOREIGN KEY ("snapshotId") REFERENCES "project_score_snapshots"("id") ON DELETE CASCADE ON UPDATE CASCADE;
