-- Line items declared on a collection request (kit `s.items`).
CREATE TABLE "submission_items" (
    "id" TEXT NOT NULL,
    "submission_id" VARCHAR(16) NOT NULL,
    "name" TEXT NOT NULL,
    "qty" INTEGER NOT NULL DEFAULT 0,
    "weight_kg" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "hsn" TEXT NOT NULL DEFAULT '854890',
    "category_id" TEXT,
    "invoice_id" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "submission_items_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "submission_items_submission_id_idx" ON "submission_items"("submission_id");

ALTER TABLE "submission_items" ADD CONSTRAINT "submission_items_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
