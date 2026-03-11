-- Enable pgvector extension for vector similarity search
CREATE EXTENSION IF NOT EXISTS vector;

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "avatarUrl" TEXT,
    "hashedPassword" TEXT,
    "role" TEXT NOT NULL DEFAULT 'user',
    "preferredLocale" TEXT NOT NULL DEFAULT 'en',
    "emailVerifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refreshToken" TEXT,
    "accessToken" TEXT,
    "expiresAt" INTEGER,
    "tokenType" TEXT,
    "scope" TEXT,
    "idToken" TEXT,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_tokens" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "preview_analyses" (
    "id" TEXT NOT NULL,
    "websiteUrl" TEXT NOT NULL,
    "brandName" TEXT NOT NULL,
    "queryTargets" TEXT[],
    "aiReadinessScore" DOUBLE PRECISION,
    "fanoutCoverageScore" DOUBLE PRECISION,
    "passageQualityScore" DOUBLE PRECISION,
    "chunkabilityScore" DOUBLE PRECISION,
    "entityCoherenceScore" DOUBLE PRECISION,
    "crossPlatformScore" DOUBLE PRECISION,
    "insights" JSONB,
    "contentsFound" INTEGER,
    "analysisData" JSONB,
    "userId" TEXT,
    "projectId" TEXT,
    "convertedAt" TIMESTAMP(3),
    "reportEmail" TEXT,
    "reportSentAt" TIMESTAMP(3),
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "referrer" TEXT,
    "locale" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL DEFAULT NOW() + INTERVAL '30 days',

    CONSTRAINT "preview_analyses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "brandName" TEXT NOT NULL,
    "websiteUrl" TEXT NOT NULL,
    "brandContext" TEXT,
    "previewId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "target_queries" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "queryText" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "target_queries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fanout_queries" (
    "id" TEXT NOT NULL,
    "targetQueryId" TEXT NOT NULL,
    "queryText" TEXT NOT NULL,
    "queryType" TEXT NOT NULL,
    "embedding" vector(1024),
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "batchId" TEXT NOT NULL,

    CONSTRAINT "fanout_queries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contents" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "title" TEXT,
    "platform" TEXT NOT NULL,
    "contentType" TEXT NOT NULL DEFAULT 'own',
    "source" TEXT NOT NULL DEFAULT 'discovery',
    "isIndexed" BOOLEAN NOT NULL DEFAULT true,
    "isConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "rawText" TEXT,
    "wordCount" INTEGER,
    "lastFetchedAt" TIMESTAMP(3),
    "lastModifiedAt" TIMESTAMP(3),
    "discoveryConfidence" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "passages" (
    "id" TEXT NOT NULL,
    "contentId" TEXT NOT NULL,
    "passageText" TEXT NOT NULL,
    "passageIndex" INTEGER NOT NULL,
    "wordCount" INTEGER,
    "heading" TEXT,
    "embedding" vector(1024),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "passages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "competitors" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "websiteUrl" TEXT,
    "source" TEXT NOT NULL DEFAULT 'auto',
    "isConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "competitors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "competitor_contents" (
    "id" TEXT NOT NULL,
    "competitorId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "title" TEXT,
    "rawText" TEXT,
    "foundForQueryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "competitor_contents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "competitor_passages" (
    "id" TEXT NOT NULL,
    "competitorContentId" TEXT NOT NULL,
    "passageText" TEXT NOT NULL,
    "passageIndex" INTEGER NOT NULL,
    "wordCount" INTEGER,
    "embedding" vector(1024),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "competitor_passages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_score_snapshots" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "snapshotType" TEXT NOT NULL DEFAULT 'weekly',
    "aiReadinessScore" DOUBLE PRECISION NOT NULL,
    "fanoutCoverageScore" DOUBLE PRECISION NOT NULL,
    "passageQualityScore" DOUBLE PRECISION NOT NULL,
    "chunkabilityScore" DOUBLE PRECISION NOT NULL,
    "entityCoherenceScore" DOUBLE PRECISION NOT NULL,
    "crossPlatformScore" DOUBLE PRECISION NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_score_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_scores" (
    "id" TEXT NOT NULL,
    "contentId" TEXT NOT NULL,
    "snapshotId" TEXT NOT NULL,
    "overallScore" DOUBLE PRECISION NOT NULL,
    "passageQualityScore" DOUBLE PRECISION,
    "chunkabilityScore" DOUBLE PRECISION,
    "fanoutCoverageScore" DOUBLE PRECISION,
    "weakestPassageId" TEXT,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "content_scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "passage_scores" (
    "id" TEXT NOT NULL,
    "passageId" TEXT NOT NULL,
    "snapshotId" TEXT NOT NULL,
    "selfContainedness" DOUBLE PRECISION,
    "claimClarity" DOUBLE PRECISION,
    "informationDensity" DOUBLE PRECISION,
    "completeness" DOUBLE PRECISION,
    "verifiability" DOUBLE PRECISION,
    "overallScore" DOUBLE PRECISION,
    "llmReasoning" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "passage_scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fanout_coverage_map" (
    "id" TEXT NOT NULL,
    "fanoutQueryId" TEXT NOT NULL,
    "passageId" TEXT NOT NULL,
    "similarityScore" DOUBLE PRECISION NOT NULL,
    "isCovered" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fanout_coverage_map_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recommendations" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "contentId" TEXT,
    "passageId" TEXT,
    "type" TEXT NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "effort" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "suggestedAction" TEXT,
    "estimatedImpact" DOUBLE PRECISION,
    "targetScore" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "snapshotId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recommendations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jobs" (
    "id" TEXT NOT NULL,
    "projectId" TEXT,
    "previewId" TEXT,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "payload" JSONB,
    "result" JSONB,
    "error" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "projectId" TEXT,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_provider_providerAccountId_key" ON "accounts"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_sessionToken_key" ON "sessions"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_token_key" ON "verification_tokens"("token");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_identifier_token_key" ON "verification_tokens"("identifier", "token");

-- CreateIndex
CREATE INDEX "preview_analyses_status_idx" ON "preview_analyses"("status");

-- CreateIndex
CREATE INDEX "preview_analyses_userId_idx" ON "preview_analyses"("userId");

-- CreateIndex
CREATE INDEX "preview_analyses_reportEmail_idx" ON "preview_analyses"("reportEmail");

-- CreateIndex
CREATE INDEX "projects_userId_idx" ON "projects"("userId");

-- CreateIndex
CREATE INDEX "target_queries_projectId_idx" ON "target_queries"("projectId");

-- CreateIndex
CREATE INDEX "fanout_queries_targetQueryId_idx" ON "fanout_queries"("targetQueryId");

-- CreateIndex
CREATE INDEX "fanout_queries_batchId_idx" ON "fanout_queries"("batchId");

-- CreateIndex
CREATE INDEX "contents_projectId_idx" ON "contents"("projectId");

-- CreateIndex
CREATE INDEX "contents_platform_idx" ON "contents"("platform");

-- CreateIndex
CREATE UNIQUE INDEX "contents_url_projectId_key" ON "contents"("url", "projectId");

-- CreateIndex
CREATE INDEX "passages_contentId_idx" ON "passages"("contentId");

-- CreateIndex
CREATE INDEX "competitors_projectId_idx" ON "competitors"("projectId");

-- CreateIndex
CREATE INDEX "project_score_snapshots_projectId_idx" ON "project_score_snapshots"("projectId");

-- CreateIndex
CREATE INDEX "content_scores_contentId_idx" ON "content_scores"("contentId");

-- CreateIndex
CREATE INDEX "content_scores_snapshotId_idx" ON "content_scores"("snapshotId");

-- CreateIndex
CREATE INDEX "passage_scores_passageId_idx" ON "passage_scores"("passageId");

-- CreateIndex
CREATE INDEX "passage_scores_snapshotId_idx" ON "passage_scores"("snapshotId");

-- CreateIndex
CREATE INDEX "fanout_coverage_map_fanoutQueryId_idx" ON "fanout_coverage_map"("fanoutQueryId");

-- CreateIndex
CREATE INDEX "fanout_coverage_map_passageId_idx" ON "fanout_coverage_map"("passageId");

-- CreateIndex
CREATE INDEX "recommendations_projectId_idx" ON "recommendations"("projectId");

-- CreateIndex
CREATE INDEX "recommendations_contentId_idx" ON "recommendations"("contentId");

-- CreateIndex
CREATE INDEX "jobs_status_idx" ON "jobs"("status");

-- CreateIndex
CREATE INDEX "jobs_projectId_idx" ON "jobs"("projectId");

-- CreateIndex
CREATE INDEX "jobs_previewId_idx" ON "jobs"("previewId");

-- CreateIndex
CREATE INDEX "notifications_userId_idx" ON "notifications"("userId");

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "preview_analyses" ADD CONSTRAINT "preview_analyses_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "preview_analyses" ADD CONSTRAINT "preview_analyses_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "target_queries" ADD CONSTRAINT "target_queries_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fanout_queries" ADD CONSTRAINT "fanout_queries_targetQueryId_fkey" FOREIGN KEY ("targetQueryId") REFERENCES "target_queries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contents" ADD CONSTRAINT "contents_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "passages" ADD CONSTRAINT "passages_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "contents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competitors" ADD CONSTRAINT "competitors_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competitor_contents" ADD CONSTRAINT "competitor_contents_competitorId_fkey" FOREIGN KEY ("competitorId") REFERENCES "competitors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competitor_contents" ADD CONSTRAINT "competitor_contents_foundForQueryId_fkey" FOREIGN KEY ("foundForQueryId") REFERENCES "target_queries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competitor_passages" ADD CONSTRAINT "competitor_passages_competitorContentId_fkey" FOREIGN KEY ("competitorContentId") REFERENCES "competitor_contents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_score_snapshots" ADD CONSTRAINT "project_score_snapshots_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_scores" ADD CONSTRAINT "content_scores_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "contents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_scores" ADD CONSTRAINT "content_scores_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "project_score_snapshots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_scores" ADD CONSTRAINT "content_scores_weakestPassageId_fkey" FOREIGN KEY ("weakestPassageId") REFERENCES "passages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "passage_scores" ADD CONSTRAINT "passage_scores_passageId_fkey" FOREIGN KEY ("passageId") REFERENCES "passages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "passage_scores" ADD CONSTRAINT "passage_scores_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "project_score_snapshots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fanout_coverage_map" ADD CONSTRAINT "fanout_coverage_map_fanoutQueryId_fkey" FOREIGN KEY ("fanoutQueryId") REFERENCES "fanout_queries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fanout_coverage_map" ADD CONSTRAINT "fanout_coverage_map_passageId_fkey" FOREIGN KEY ("passageId") REFERENCES "passages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendations" ADD CONSTRAINT "recommendations_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendations" ADD CONSTRAINT "recommendations_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "contents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendations" ADD CONSTRAINT "recommendations_passageId_fkey" FOREIGN KEY ("passageId") REFERENCES "passages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendations" ADD CONSTRAINT "recommendations_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "project_score_snapshots"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_previewId_fkey" FOREIGN KEY ("previewId") REFERENCES "preview_analyses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
