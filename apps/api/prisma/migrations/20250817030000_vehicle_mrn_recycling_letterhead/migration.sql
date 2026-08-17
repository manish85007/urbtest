-- Vehicle breakdown remark, MRN gate/in-vehicle photos, recycling devices destroyed.
ALTER TABLE "vehicles" ADD COLUMN "change_remark" TEXT;

ALTER TABLE "mrns" ADD COLUMN "gate_photo_ids" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "mrns" ADD COLUMN "material_photo_ids" TEXT[] DEFAULT ARRAY[]::TEXT[];

ALTER TABLE "recycling" ADD COLUMN "devices_destroyed" INTEGER NOT NULL DEFAULT 0;
