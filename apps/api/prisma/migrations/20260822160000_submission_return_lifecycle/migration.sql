-- Return-to-requestor workflow: track who returned and persist lifecycle events.
ALTER TABLE "submissions" ADD COLUMN IF NOT EXISTS "reject_by" TEXT;

CREATE TABLE IF NOT EXISTS "submission_lifecycle_events" (
    "id" TEXT NOT NULL,
    "submission_id" VARCHAR(16) NOT NULL,
    "event" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "actor_email" TEXT NOT NULL,
    "details" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "submission_lifecycle_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "submission_lifecycle_events_submission_id_created_at_idx"
ON "submission_lifecycle_events"("submission_id", "created_at");

ALTER TABLE "submission_lifecycle_events" DROP CONSTRAINT IF EXISTS "submission_lifecycle_events_submission_id_fkey";
ALTER TABLE "submission_lifecycle_events" ADD CONSTRAINT "submission_lifecycle_events_submission_id_fkey"
FOREIGN KEY ("submission_id") REFERENCES "submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
