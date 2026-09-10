-- Delivery challan reference on MRN (goods may arrive before tax invoice).
ALTER TABLE "mrns" ADD COLUMN IF NOT EXISTS "delivery_challan_no" TEXT;
ALTER TABLE "mrns" ADD COLUMN IF NOT EXISTS "delivery_challan_date" DATE;
