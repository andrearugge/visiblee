-- Migration E.1: add source, manualDescription, manualSampleQueries to intent_profiles
-- Run with superuser on production/staging DB

ALTER TABLE "intent_profiles"
  ADD COLUMN IF NOT EXISTS "source" TEXT NOT NULL DEFAULT 'gsc',
  ADD COLUMN IF NOT EXISTS "manualDescription" TEXT,
  ADD COLUMN IF NOT EXISTS "manualSampleQueries" TEXT[] NOT NULL DEFAULT '{}';
