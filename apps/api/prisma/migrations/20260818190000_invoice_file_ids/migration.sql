-- Allow multiple invoice PDF and e-way bill PDF attachments.
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "invoice_file_ids" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "eway_file_ids" TEXT[] DEFAULT ARRAY[]::TEXT[];

UPDATE "invoices"
SET "invoice_file_ids" = ARRAY["invoice_file_id"]
WHERE "invoice_file_id" IS NOT NULL
  AND "invoice_file_id" <> ''
  AND (COALESCE(cardinality("invoice_file_ids"), 0) = 0);

UPDATE "invoices"
SET "eway_file_ids" = ARRAY["eway_file_id"]
WHERE "eway_file_id" IS NOT NULL
  AND "eway_file_id" <> ''
  AND (COALESCE(cardinality("eway_file_ids"), 0) = 0);
