-- AlterTable
ALTER TABLE "preview_analyses" ALTER COLUMN "expiresAt" SET DEFAULT NOW() + INTERVAL '30 days';

-- CreateTable
CREATE TABLE "gsc_connections" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "tokenExpiresAt" TIMESTAMP(3) NOT NULL,
    "propertyUrl" TEXT,
    "propertyType" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "lastSyncAt" TIMESTAMP(3),
    "lastSyncError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gsc_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gsc_query_data" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "page" TEXT,
    "country" TEXT,
    "device" TEXT,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "ctr" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "position" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "dateStart" TIMESTAMP(3) NOT NULL,
    "dateEnd" TIMESTAMP(3) NOT NULL,
    "syncBatchId" TEXT NOT NULL,
    "intentType" TEXT,
    "intentScore" DOUBLE PRECISION,
    "isLongQuery" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gsc_query_data_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "intent_profiles" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "dominantIntent" TEXT NOT NULL,
    "dominantDevice" TEXT,
    "dominantCountry" TEXT,
    "avgQueryLength" DOUBLE PRECISION NOT NULL,
    "queryCount" INTEGER NOT NULL,
    "totalImpressions" INTEGER NOT NULL,
    "topPatterns" JSONB NOT NULL,
    "sampleQueries" JSONB NOT NULL,
    "contextPrompt" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "intent_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "citation_check_variants" (
    "id" TEXT NOT NULL,
    "citationCheckId" TEXT NOT NULL,
    "intentProfileId" TEXT NOT NULL,
    "userCited" BOOLEAN NOT NULL DEFAULT false,
    "userCitedPosition" INTEGER,
    "userCitedSegment" TEXT,
    "citedSources" JSONB,
    "responseText" TEXT,
    "searchQueries" JSONB,
    "contextPromptUsed" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "citation_check_variants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gsc_query_suggestions" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "intentType" TEXT NOT NULL,
    "impressions" INTEGER NOT NULL,
    "clicks" INTEGER NOT NULL,
    "avgPosition" DOUBLE PRECISION NOT NULL,
    "matchedTargetQueryId" TEXT,
    "similarityScore" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gsc_query_suggestions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "gsc_connections_projectId_key" ON "gsc_connections"("projectId");

-- CreateIndex
CREATE INDEX "gsc_query_data_projectId_impressions_idx" ON "gsc_query_data"("projectId", "impressions" DESC);

-- CreateIndex
CREATE INDEX "gsc_query_data_projectId_intentType_idx" ON "gsc_query_data"("projectId", "intentType");

-- CreateIndex
CREATE INDEX "gsc_query_data_projectId_isLongQuery_idx" ON "gsc_query_data"("projectId", "isLongQuery");

-- CreateIndex
CREATE UNIQUE INDEX "gsc_query_data_projectId_query_country_device_dateStart_dat_key" ON "gsc_query_data"("projectId", "query", "country", "device", "dateStart", "dateEnd");

-- CreateIndex
CREATE UNIQUE INDEX "intent_profiles_projectId_slug_key" ON "intent_profiles"("projectId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "citation_check_variants_citationCheckId_intentProfileId_key" ON "citation_check_variants"("citationCheckId", "intentProfileId");

-- CreateIndex
CREATE UNIQUE INDEX "gsc_query_suggestions_projectId_query_key" ON "gsc_query_suggestions"("projectId", "query");

-- AddForeignKey
ALTER TABLE "gsc_connections" ADD CONSTRAINT "gsc_connections_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gsc_connections" ADD CONSTRAINT "gsc_connections_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gsc_query_data" ADD CONSTRAINT "gsc_query_data_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intent_profiles" ADD CONSTRAINT "intent_profiles_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "citation_check_variants" ADD CONSTRAINT "citation_check_variants_citationCheckId_fkey" FOREIGN KEY ("citationCheckId") REFERENCES "citation_checks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "citation_check_variants" ADD CONSTRAINT "citation_check_variants_intentProfileId_fkey" FOREIGN KEY ("intentProfileId") REFERENCES "intent_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gsc_query_suggestions" ADD CONSTRAINT "gsc_query_suggestions_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
