/*
  Warnings:

  - Added the required column `updatedAt` to the `target_queries` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "preview_analyses" ALTER COLUMN "expiresAt" SET DEFAULT NOW() + INTERVAL '30 days';

-- AlterTable
ALTER TABLE "target_queries" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();
