-- AlterTable
ALTER TABLE "competitor_passages" ADD COLUMN     "overallScore" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "competitors" ADD COLUMN     "avgPassageScore" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "preview_analyses" ALTER COLUMN "expiresAt" SET DEFAULT NOW() + INTERVAL '30 days';
