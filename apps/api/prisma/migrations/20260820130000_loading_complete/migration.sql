-- Loading complete acknowledgement (weighment gate before invoicing)
ALTER TABLE "submissions" ADD COLUMN IF NOT EXISTS "loading_completed_at" TIMESTAMP(3);
ALTER TABLE "submissions" ADD COLUMN IF NOT EXISTS "loading_completed_by" TEXT;
