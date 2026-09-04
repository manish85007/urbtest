-- Persist auth rate-limit counters across Cloud Run instances
CREATE TABLE IF NOT EXISTS "rate_limit_buckets" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "reset_at" TIMESTAMP(3) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rate_limit_buckets_pkey" PRIMARY KEY ("key")
);

-- Email queue exponential backoff
ALTER TABLE "email_outbox" ADD COLUMN IF NOT EXISTS "next_retry_at" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "email_outbox_status_next_retry_at_idx"
  ON "email_outbox"("status", "next_retry_at");
