-- CreateTable
CREATE TABLE "competitor_query_appearances" (
    "id" TEXT NOT NULL,
    "competitorId" TEXT NOT NULL,
    "targetQueryId" TEXT NOT NULL,
    "citationCheckId" TEXT NOT NULL,
    "position" INTEGER,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "competitor_query_appearances_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "competitor_query_appearances_competitorId_idx" ON "competitor_query_appearances"("competitorId");

-- CreateIndex
CREATE INDEX "competitor_query_appearances_targetQueryId_idx" ON "competitor_query_appearances"("targetQueryId");

-- CreateIndex
CREATE INDEX "competitor_query_appearances_citationCheckId_idx" ON "competitor_query_appearances"("citationCheckId");

-- AddForeignKey
ALTER TABLE "competitor_query_appearances" ADD CONSTRAINT "competitor_query_appearances_competitorId_fkey"
    FOREIGN KEY ("competitorId") REFERENCES "competitors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competitor_query_appearances" ADD CONSTRAINT "competitor_query_appearances_targetQueryId_fkey"
    FOREIGN KEY ("targetQueryId") REFERENCES "target_queries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competitor_query_appearances" ADD CONSTRAINT "competitor_query_appearances_citationCheckId_fkey"
    FOREIGN KEY ("citationCheckId") REFERENCES "citation_checks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
