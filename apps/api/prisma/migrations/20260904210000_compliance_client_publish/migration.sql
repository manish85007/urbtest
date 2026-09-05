-- Super Admin certify gate: Form 6 + CoD publish to client portal
ALTER TABLE "recycling" ADD COLUMN IF NOT EXISTS "client_published_at" TIMESTAMP(3);
ALTER TABLE "recycling" ADD COLUMN IF NOT EXISTS "client_published_by" TEXT;
ALTER TABLE "recycling" ADD COLUMN IF NOT EXISTS "client_publish_note" TEXT;

-- Preserve existing client-visible packages (approved Form 6 already released historically).
UPDATE "recycling" r
SET
  "client_published_at" = COALESCE(r."reviewed_at", r."created_at"),
  "client_published_by" = COALESCE(r."reviewed_by", 'migration:compliance_client_publish')
WHERE r."review_status" = 'approved'
  AND r."client_published_at" IS NULL;
