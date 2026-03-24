-- Add richer citation fields to citation_checks table
ALTER TABLE citation_checks
  ADD COLUMN IF NOT EXISTS "userCitedPosition" INTEGER,
  ADD COLUMN IF NOT EXISTS "userCitedSegment"  TEXT,
  ADD COLUMN IF NOT EXISTS "responseText"      TEXT;
