-- Form 6 admin review gate before client visibility / email
ALTER TABLE "recycling"
  ADD COLUMN IF NOT EXISTS "review_status" VARCHAR(24) NOT NULL DEFAULT 'pending_review',
  ADD COLUMN IF NOT EXISTS "reviewed_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "reviewed_by" TEXT,
  ADD COLUMN IF NOT EXISTS "review_note" TEXT;

-- Existing Form 6 records were already issued to clients — treat as approved
UPDATE "recycling"
SET "review_status" = 'approved',
    "reviewed_at" = COALESCE("reviewed_at", "created_at"),
    "reviewed_by" = COALESCE("reviewed_by", "created_by")
WHERE "review_status" = 'pending_review';
