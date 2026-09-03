-- Client portal logo display toggle (admin-controlled, off by default).
ALTER TABLE "clients" ADD COLUMN "show_portal_logo" BOOLEAN NOT NULL DEFAULT false;

-- MFA method: 'totp' (authenticator) or 'email'. Existing secrets default to totp.
ALTER TABLE "users" ADD COLUMN "mfa_method" TEXT;
UPDATE "users" SET "mfa_method" = 'totp' WHERE "mfa_secret" IS NOT NULL AND "mfa_method" IS NULL;
