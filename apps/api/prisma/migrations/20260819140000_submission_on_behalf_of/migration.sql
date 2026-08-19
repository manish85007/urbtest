-- Add on_behalf_of to submissions for admin-raised requests tagged to a client contact
ALTER TABLE "submissions" ADD COLUMN IF NOT EXISTS "on_behalf_of" TEXT;
