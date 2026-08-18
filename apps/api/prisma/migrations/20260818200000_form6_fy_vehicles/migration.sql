-- Form 6 fiscal-year sequence (April–March) and vehicles captured on the manifest.
CREATE TABLE "form6_counters" (
    "fy" VARCHAR(4) NOT NULL,
    "last_value" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "form6_counters_pkey" PRIMARY KEY ("fy")
);

ALTER TABLE "recycling" ADD COLUMN "vehicle_ids" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

CREATE UNIQUE INDEX "recycling_form6_no_key" ON "recycling"("form6_no");
