-- AlterTable
ALTER TABLE "sites" ADD COLUMN "city" TEXT;
ALTER TABLE "sites" ADD COLUMN "state" TEXT;
ALTER TABLE "sites" ADD COLUMN "pin" VARCHAR(10);
ALTER TABLE "sites" ADD COLUMN "contact_email" TEXT;

-- AlterTable
ALTER TABLE "factory_sites" ADD COLUMN "manager_email" TEXT;
