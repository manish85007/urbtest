ALTER TABLE "vehicles" ALTER COLUMN "expected_at" TYPE TIMESTAMP(3) USING "expected_at"::timestamp;
