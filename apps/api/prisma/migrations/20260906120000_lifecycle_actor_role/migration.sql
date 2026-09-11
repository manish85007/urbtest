-- Store actor role on lifecycle events so client portal can show role without personal identity.
ALTER TABLE "submission_lifecycle_events" ADD COLUMN IF NOT EXISTS "actor_role" TEXT;

-- Backfill from current user roles (best effort for historical events).
UPDATE "submission_lifecycle_events" AS e
SET "actor_role" = u."role"::text
FROM "users" AS u
WHERE e."actor_role" IS NULL
  AND lower(e."actor_email") = lower(u."email");
