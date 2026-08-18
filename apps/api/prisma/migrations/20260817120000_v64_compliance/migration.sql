-- AlterTable
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "password_set_at" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "must_reset" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "mfa_secret" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "mfa_at" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "last_login_at" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "failed_login_count" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "locked_until" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "audit_log" ADD COLUMN IF NOT EXISTS "seq" INTEGER;
ALTER TABLE "audit_log" ADD COLUMN IF NOT EXISTS "prev_hash" TEXT NOT NULL DEFAULT 'GENESIS';
ALTER TABLE "audit_log" ADD COLUMN IF NOT EXISTS "hash" TEXT NOT NULL DEFAULT '';

UPDATE "audit_log" AS a
SET seq = s.n
FROM (
  SELECT id, ROW_NUMBER() OVER (ORDER BY ts ASC, id ASC) AS n FROM "audit_log"
) s
WHERE a.id = s.id;

CREATE SEQUENCE IF NOT EXISTS "audit_log_seq_seq";
SELECT setval(
  'audit_log_seq_seq',
  COALESCE((SELECT MAX(seq) FROM "audit_log"), 1),
  (SELECT COUNT(*) > 0 FROM "audit_log")
);
UPDATE "audit_log" SET seq = nextval('audit_log_seq_seq') WHERE seq IS NULL;
ALTER TABLE "audit_log" ALTER COLUMN "seq" SET DEFAULT nextval('audit_log_seq_seq');
ALTER TABLE "audit_log" ALTER COLUMN "seq" SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "audit_log_seq_key" ON "audit_log"("seq");

-- CreateTable
CREATE TABLE IF NOT EXISTS "password_history" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_history_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "password_history_user_id_created_at_idx" ON "password_history"("user_id", "created_at");
DO $$ BEGIN
  ALTER TABLE "password_history" ADD CONSTRAINT "password_history_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "security_events" (
    "id" TEXT NOT NULL,
    "ts" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "kind" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "detail" JSONB NOT NULL DEFAULT '{}',
    "user_agent" TEXT,

    CONSTRAINT "security_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "security_events_ts_idx" ON "security_events"("ts");
CREATE INDEX IF NOT EXISTS "security_events_kind_idx" ON "security_events"("kind");
CREATE INDEX IF NOT EXISTS "security_events_severity_idx" ON "security_events"("severity");

CREATE TABLE IF NOT EXISTS "consent_records" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "email" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip" TEXT,
    "withdrawn" BOOLEAN NOT NULL DEFAULT false,
    "reason" TEXT,

    CONSTRAINT "consent_records_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "consent_records_email_at_idx" ON "consent_records"("email", "at");
DO $$ BEGIN
  ALTER TABLE "consent_records" ADD CONSTRAINT "consent_records_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "dsr_requests" (
    "id" TEXT NOT NULL,
    "ref" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "client_id" VARCHAR(4),
    "raised_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "raised_by" TEXT,
    "due" DATE NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'open',
    "closed_at" TIMESTAMP(3),
    "closed_by" TEXT,
    "outcome" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "dsr_requests_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "dsr_requests_ref_key" ON "dsr_requests"("ref");
CREATE INDEX IF NOT EXISTS "dsr_requests_status_due_idx" ON "dsr_requests"("status", "due");

CREATE TABLE IF NOT EXISTS "incidents" (
    "id" TEXT NOT NULL,
    "ref" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "category" TEXT,
    "detected_at" DATE NOT NULL,
    "raised_by" TEXT,
    "raised_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "description" TEXT NOT NULL DEFAULT '',
    "summary" TEXT NOT NULL DEFAULT '',
    "affected" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'open',
    "contained_at" TIMESTAMP(3),
    "closed_at" TIMESTAMP(3),
    "closed_by" TEXT,
    "root_cause" TEXT NOT NULL DEFAULT '',
    "action" TEXT NOT NULL DEFAULT '',
    "reportable" BOOLEAN NOT NULL DEFAULT false,
    "reported_at" TIMESTAMP(3),

    CONSTRAINT "incidents_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "incidents_ref_key" ON "incidents"("ref");
CREATE INDEX IF NOT EXISTS "incidents_status_idx" ON "incidents"("status");

CREATE TABLE IF NOT EXISTS "access_reviews" (
    "id" TEXT NOT NULL,
    "ref" TEXT NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "started_by" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "closed_at" TIMESTAMP(3),
    "closed_by" TEXT,

    CONSTRAINT "access_reviews_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "access_reviews_ref_key" ON "access_reviews"("ref");
CREATE INDEX IF NOT EXISTS "access_reviews_status_idx" ON "access_reviews"("status");

CREATE TABLE IF NOT EXISTS "access_review_lines" (
    "id" TEXT NOT NULL,
    "review_id" TEXT NOT NULL,
    "user_id" TEXT,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "client_id" TEXT,
    "site_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "factory_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "last_login_at" TIMESTAMP(3),
    "decision" TEXT,
    "note" TEXT NOT NULL DEFAULT '',
    "decided_at" TIMESTAMP(3),
    "decided_by" TEXT,

    CONSTRAINT "access_review_lines_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "access_review_lines_review_id_email_key" ON "access_review_lines"("review_id", "email");
DO $$ BEGIN
  ALTER TABLE "access_review_lines" ADD CONSTRAINT "access_review_lines_review_id_fkey" FOREIGN KEY ("review_id") REFERENCES "access_reviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "access_review_lines" ADD CONSTRAINT "access_review_lines_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "disposal_records" (
    "id" TEXT NOT NULL,
    "ref" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "describes" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "by" TEXT NOT NULL,
    "approved_by" TEXT NOT NULL DEFAULT '',
    "note" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "disposal_records_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "disposal_records_ref_key" ON "disposal_records"("ref");
