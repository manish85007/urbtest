-- Allow multiple BoM attachments on a request.
ALTER TABLE "submissions" ADD COLUMN IF NOT EXISTS "bom_file_ids" TEXT[] DEFAULT ARRAY[]::TEXT[];

UPDATE "submissions"
SET "bom_file_ids" = ARRAY["bom_file_id"]
WHERE "bom_file_id" IS NOT NULL
  AND "bom_file_id" <> ''
  AND (COALESCE(cardinality("bom_file_ids"), 0) = 0);
