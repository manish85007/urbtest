-- User feature-access controls (per-user JSON flags)
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "feature_access" JSONB;
