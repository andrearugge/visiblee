-- AlterTable
ALTER TABLE "recommendations" ADD COLUMN "targetQueryId" TEXT;

-- CreateIndex
CREATE INDEX "recommendations_targetQueryId_idx" ON "recommendations"("targetQueryId");

-- AddForeignKey
ALTER TABLE "recommendations" ADD CONSTRAINT "recommendations_targetQueryId_fkey"
  FOREIGN KEY ("targetQueryId") REFERENCES "target_queries"("id") ON DELETE SET NULL ON UPDATE CASCADE;
