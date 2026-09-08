-- Client portal users can choose which lifecycle emails they receive.
CREATE TYPE "EmailNotifyMode" AS ENUM ('all', 'important_only', 'none');

ALTER TABLE "users"
  ADD COLUMN "email_notify_mode" "EmailNotifyMode" NOT NULL DEFAULT 'all';
