-- Approve Form 6 rows that already have certificates or closed invoices
-- (demo/seed data created before reviewStatus was populated explicitly).
UPDATE "recycling" r
SET
  "review_status" = 'approved',
  "reviewed_at" = COALESCE(r."reviewed_at", NOW()),
  "reviewed_by" = COALESCE(r."reviewed_by", 'system-migrate')
FROM "invoices" i
WHERE r."invoice_id" = i."id"
  AND r."review_status" = 'pending_review'
  AND (
    i."closed_at" IS NOT NULL
    OR EXISTS (SELECT 1 FROM "certificates" c WHERE c."invoice_id" = i."id")
  );
