/*
  Warnings:

  - You are about to drop the column `emailVerifiedAt` on the `users` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "preview_analyses" ALTER COLUMN "expiresAt" SET DEFAULT NOW() + INTERVAL '30 days';

-- AlterTable
ALTER TABLE "users" DROP COLUMN "emailVerifiedAt",
ADD COLUMN     "emailVerified" TIMESTAMP(3);
