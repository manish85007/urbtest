-- AlterTable
ALTER TABLE "tree_plantings" ADD COLUMN "source" TEXT NOT NULL DEFAULT 'urbeno';
ALTER TABLE "tree_plantings" ADD COLUMN "partner" TEXT;
ALTER TABLE "tree_plantings" ADD COLUMN "state" TEXT;
ALTER TABLE "tree_plantings" ADD COLUMN "species" TEXT;
