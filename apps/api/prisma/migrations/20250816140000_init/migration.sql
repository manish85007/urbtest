-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('admin', 'factory', 'client');

-- CreateEnum
CREATE TYPE "FileKind" AS ENUM ('bom', 'weighPhoto', 'pickPhoto', 'invoice', 'eway', 'certificate', 'serials', 'processing', 'report', 'logo', 'planting');

-- CreateEnum
CREATE TYPE "EmailStatus" AS ENUM ('queued', 'sent', 'failed');

-- CreateTable
CREATE TABLE "clients" (
    "id" VARCHAR(4) NOT NULL,
    "name" TEXT NOT NULL,
    "city" TEXT,
    "contact" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "logo_file_id" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "pay_terms_days" INTEGER NOT NULL DEFAULT 30,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT,

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sites" (
    "id" TEXT NOT NULL,
    "client_id" VARCHAR(4) NOT NULL,
    "code" VARCHAR(16) NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "gstin" TEXT,
    "contact_name" TEXT,
    "contact_phone" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "factory_sites" (
    "id" VARCHAR(16) NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "gstin" TEXT,
    "kspcb_consent" TEXT,
    "cpcb_epr" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "factory_sites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "client_id" VARCHAR(4),
    "factory_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "site_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "password_hash" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "category_master" (
    "id" SERIAL NOT NULL,
    "factory_id" VARCHAR(16) NOT NULL,
    "entry_id" VARCHAR(32) NOT NULL,
    "description" TEXT NOT NULL,
    "group_code" VARCHAR(8) NOT NULL,
    "activity" TEXT NOT NULL DEFAULT 'Recycling',
    "capacity_tpa" DECIMAL(10,2) NOT NULL,
    "auth_ref" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT,

    CONSTRAINT "category_master_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "submissions" (
    "id" VARCHAR(16) NOT NULL,
    "client_id" VARCHAR(4) NOT NULL,
    "site_id" TEXT NOT NULL,
    "ref" TEXT,
    "request_date" DATE NOT NULL,
    "location" TEXT,
    "approx_qty" INTEGER NOT NULL DEFAULT 0,
    "approx_weight" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "bom_file_id" TEXT,
    "notes" TEXT,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acknowledged_at" TIMESTAMP(3),
    "acknowledged_by" TEXT,
    "reject_note" TEXT,
    "reject_at" TIMESTAMP(3),
    "closed_at" TIMESTAMP(3),

    CONSTRAINT "submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicles" (
    "id" TEXT NOT NULL,
    "submission_id" VARCHAR(16) NOT NULL,
    "registration" TEXT NOT NULL,
    "vehicle_type" TEXT NOT NULL,
    "logistics_partner" TEXT,
    "driver_name" TEXT NOT NULL,
    "driver_phone" TEXT NOT NULL,
    "expected_at" DATE,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vehicles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicle_team" (
    "id" TEXT NOT NULL,
    "vehicle_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "phone" TEXT NOT NULL,

    CONSTRAINT "vehicle_team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "weighments" (
    "id" TEXT NOT NULL,
    "vehicle_id" TEXT NOT NULL,
    "manual" BOOLEAN NOT NULL DEFAULT false,
    "gross_kg" DECIMAL(12,3),
    "tare_kg" DECIMAL(12,3),
    "net_kg" DECIMAL(12,3) NOT NULL,
    "slip_number" TEXT,
    "method" TEXT,
    "reason" TEXT,
    "weighed_at" DATE NOT NULL,
    "slip_photo_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "pickup_photo_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "weighments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" TEXT NOT NULL,
    "submission_id" VARCHAR(16) NOT NULL,
    "invoice_no" TEXT NOT NULL,
    "invoice_date" DATE NOT NULL,
    "taxable_paise" BIGINT NOT NULL,
    "tax_rate_pct" DECIMAL(5,2) NOT NULL,
    "tax_paise" BIGINT NOT NULL,
    "total_paise" BIGINT NOT NULL,
    "billing_weight" DECIMAL(12,3) NOT NULL,
    "vehicle_net_kg" DECIMAL(12,3),
    "deviation_kg" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "deviation_note" TEXT,
    "billing_mode" TEXT NOT NULL DEFAULT 'urbeno',
    "eway_bill_no" TEXT NOT NULL,
    "eway_bill_date" DATE NOT NULL,
    "invoice_file_id" TEXT,
    "eway_file_id" TEXT,
    "vehicle_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closed_at" TIMESTAMP(3),
    "closed_by" TEXT,
    "close_rating" INTEGER,
    "close_note" TEXT,
    "force_closed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "invoice_id" TEXT NOT NULL,
    "utr" TEXT NOT NULL,
    "amount_paise" BIGINT NOT NULL,
    "paid_at" DATE NOT NULL,
    "mode" TEXT NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mrn_counters" (
    "factory_id" VARCHAR(16) NOT NULL,
    "fy" VARCHAR(4) NOT NULL,
    "last_value" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "mrn_counters_pkey" PRIMARY KEY ("factory_id","fy")
);

-- CreateTable
CREATE TABLE "mrns" (
    "id" TEXT NOT NULL,
    "invoice_id" TEXT NOT NULL,
    "mrn_no" TEXT NOT NULL,
    "factory_id" VARCHAR(16) NOT NULL,
    "received_at" DATE NOT NULL,
    "received_by" TEXT NOT NULL,
    "driver_sign" TEXT,
    "manager_sign" TEXT,
    "security_sign" TEXT,
    "materials" JSONB NOT NULL DEFAULT '[]',
    "condition" TEXT NOT NULL DEFAULT 'Good',
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mrns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recycling" (
    "id" TEXT NOT NULL,
    "invoice_id" TEXT NOT NULL,
    "form6_no" TEXT NOT NULL,
    "processed_at" DATE NOT NULL,
    "factory_id" VARCHAR(16) NOT NULL,
    "diverted_pct" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "recovery_fe" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "recovery_nfe" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "recovery_pl" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "recovery_pcb" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "serial_file_id" TEXT,
    "photo_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "report_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recycling_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recycling_categories" (
    "id" TEXT NOT NULL,
    "recycling_id" TEXT NOT NULL,
    "category_id" INTEGER NOT NULL,
    "entry_id" TEXT NOT NULL,
    "group_code" TEXT NOT NULL,
    "weight_kg" DECIMAL(12,3) NOT NULL,
    "recovery_fe" DECIMAL(12,3) NOT NULL,
    "recovery_nfe" DECIMAL(12,3) NOT NULL,
    "recovery_pl" DECIMAL(12,3) NOT NULL,
    "recovery_pcb" DECIMAL(12,3) NOT NULL,
    "override_reason" TEXT,

    CONSTRAINT "recycling_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "serials" (
    "id" TEXT NOT NULL,
    "recycling_id" TEXT NOT NULL,
    "serial_no" TEXT NOT NULL,
    "asset_tag" TEXT,
    "make" TEXT,
    "model" TEXT,
    "destroyed_at" TIMESTAMP(3),
    "destroy_std" TEXT,
    "destroy_method" TEXT,
    "destroy_op" TEXT,
    "dcod_no" TEXT,

    CONSTRAINT "serials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "certificates" (
    "id" TEXT NOT NULL,
    "invoice_id" TEXT NOT NULL,
    "cert_no" TEXT NOT NULL,
    "cert_date" DATE NOT NULL,
    "department" TEXT,
    "file_id" TEXT NOT NULL,
    "note" TEXT,
    "uploaded_by" TEXT NOT NULL,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "mailed_at" TIMESTAMP(3),

    CONSTRAINT "certificates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "files" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "kind" "FileKind" NOT NULL,
    "storage_key" TEXT NOT NULL,
    "uploaded_by" TEXT,
    "context" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" TEXT NOT NULL,
    "ts" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actor_email" TEXT NOT NULL,
    "actor_id" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entity_id" TEXT,
    "details" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "link" TEXT,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_outbox" (
    "id" TEXT NOT NULL,
    "template_key" TEXT NOT NULL,
    "template_name" TEXT,
    "to" TEXT[],
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" "EmailStatus" NOT NULL DEFAULT 'queued',
    "vars" JSONB NOT NULL DEFAULT '{}',
    "attachments" JSONB NOT NULL DEFAULT '[]',
    "error" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_outbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reminder_log" (
    "key" TEXT NOT NULL,
    "last_run" DATE NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reminder_log_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "email_templates" (
    "id" TEXT NOT NULL,
    "key" TEXT,
    "name" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "editable" BOOLEAN NOT NULL DEFAULT true,
    "variables" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "legal_documents" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "effective_date" DATE NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "legal_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "legal_acceptances" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "document_key" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "accepted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip_address" TEXT,

    CONSTRAINT "legal_acceptances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lookup_masters" (
    "id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lookup_masters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tree_plantings" (
    "id" TEXT NOT NULL,
    "client_id" VARCHAR(4),
    "trees" INTEGER NOT NULL,
    "planted_at" DATE NOT NULL,
    "location" TEXT,
    "photo_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tree_plantings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "id_sequences" (
    "key" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "pad" INTEGER NOT NULL DEFAULT 5,
    "next_value" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "id_sequences_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "sites_client_id_code_key" ON "sites"("client_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_token_key" ON "sessions"("token");

-- CreateIndex
CREATE UNIQUE INDEX "category_master_factory_id_entry_id_key" ON "category_master"("factory_id", "entry_id");

-- CreateIndex
CREATE UNIQUE INDEX "weighments_vehicle_id_key" ON "weighments"("vehicle_id");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_submission_id_invoice_no_key" ON "invoices"("submission_id", "invoice_no");

-- CreateIndex
CREATE UNIQUE INDEX "mrns_invoice_id_key" ON "mrns"("invoice_id");

-- CreateIndex
CREATE UNIQUE INDEX "mrns_mrn_no_key" ON "mrns"("mrn_no");

-- CreateIndex
CREATE UNIQUE INDEX "recycling_invoice_id_key" ON "recycling"("invoice_id");

-- CreateIndex
CREATE UNIQUE INDEX "certificates_cert_no_key" ON "certificates"("cert_no");

-- CreateIndex
CREATE INDEX "audit_log_ts_idx" ON "audit_log"("ts");

-- CreateIndex
CREATE INDEX "audit_log_entity_entity_id_idx" ON "audit_log"("entity", "entity_id");

-- CreateIndex
CREATE INDEX "notifications_user_id_read_idx" ON "notifications"("user_id", "read");

-- CreateIndex
CREATE INDEX "email_outbox_status_created_at_idx" ON "email_outbox"("status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "email_templates_key_key" ON "email_templates"("key");

-- CreateIndex
CREATE UNIQUE INDEX "legal_documents_key_key" ON "legal_documents"("key");

-- CreateIndex
CREATE INDEX "legal_acceptances_user_id_idx" ON "legal_acceptances"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "legal_acceptances_user_id_document_key_version_key" ON "legal_acceptances"("user_id", "document_key", "version");

-- CreateIndex
CREATE INDEX "lookup_masters_category_idx" ON "lookup_masters"("category");

-- CreateIndex
CREATE UNIQUE INDEX "lookup_masters_category_id_key" ON "lookup_masters"("category", "id");

-- AddForeignKey
ALTER TABLE "sites" ADD CONSTRAINT "sites_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "category_master" ADD CONSTRAINT "category_master_factory_id_fkey" FOREIGN KEY ("factory_id") REFERENCES "factory_sites"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_team" ADD CONSTRAINT "vehicle_team_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "weighments" ADD CONSTRAINT "weighments_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mrn_counters" ADD CONSTRAINT "mrn_counters_factory_id_fkey" FOREIGN KEY ("factory_id") REFERENCES "factory_sites"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mrns" ADD CONSTRAINT "mrns_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mrns" ADD CONSTRAINT "mrns_factory_id_fkey" FOREIGN KEY ("factory_id") REFERENCES "factory_sites"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recycling" ADD CONSTRAINT "recycling_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recycling" ADD CONSTRAINT "recycling_factory_id_fkey" FOREIGN KEY ("factory_id") REFERENCES "factory_sites"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recycling_categories" ADD CONSTRAINT "recycling_categories_recycling_id_fkey" FOREIGN KEY ("recycling_id") REFERENCES "recycling"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recycling_categories" ADD CONSTRAINT "recycling_categories_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "category_master"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "serials" ADD CONSTRAINT "serials_recycling_id_fkey" FOREIGN KEY ("recycling_id") REFERENCES "recycling"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "legal_acceptances" ADD CONSTRAINT "legal_acceptances_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

