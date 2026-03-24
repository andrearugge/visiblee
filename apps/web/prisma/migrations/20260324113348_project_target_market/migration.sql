-- AlterTable
ALTER TABLE "preview_analyses" ALTER COLUMN "expiresAt" SET DEFAULT NOW() + INTERVAL '30 days';

-- AlterTable
ALTER TABLE "target_queries" ALTER COLUMN "updatedAt" DROP DEFAULT;
