-- Freeze company + factory letterhead on MRN / Form 6 at issue time.
ALTER TABLE "mrns" ADD COLUMN IF NOT EXISTS "letterhead_snapshot" JSONB;
ALTER TABLE "recycling" ADD COLUMN IF NOT EXISTS "letterhead_snapshot" JSONB;
