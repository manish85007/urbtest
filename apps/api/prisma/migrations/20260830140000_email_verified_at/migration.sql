-- Periodic email OTP re-verification (every 90 days) after password (+ MFA) login.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "email_verified_at" TIMESTAMP(3);

-- Soft rollout: existing active users are treated as verified now so the first
-- challenge lands ~90 days later (or sooner if last_login is older — we use NOW).
UPDATE "users"
SET "email_verified_at" = NOW()
WHERE "email_verified_at" IS NULL AND "active" = true;
