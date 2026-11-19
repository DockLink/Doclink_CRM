-- Independent invoice clients: detach invoicing from CRM leads

CREATE TYPE "BillingType" AS ENUM ('one_time_development', 'monthly_retainer', 'both');
CREATE TYPE "RecurringInvoiceStatus" AS ENUM ('active', 'paused');
CREATE TYPE "InvoiceNotificationType" AS ENUM ('recurring_draft_created', 'recurring_draft_failed');

-- Rename issued -> sent on InvoiceStatus
ALTER TYPE "InvoiceStatus" RENAME VALUE 'issued' TO 'sent';

ALTER TABLE "invoice_payment_accounts"
  ADD COLUMN IF NOT EXISTS "branch" TEXT;

CREATE TABLE "invoice_clients" (
  "id" UUID NOT NULL,
  "client_name" TEXT NOT NULL,
  "company_name" TEXT NOT NULL,
  "contact_person" TEXT,
  "email" TEXT,
  "phone" TEXT,
  "billing_address" TEXT,
  "city" TEXT,
  "country" TEXT,
  "postal_code" TEXT,
  "client_type" "ClientType" NOT NULL DEFAULT 'new',
  "billing_type" "BillingType" NOT NULL DEFAULT 'one_time_development',
  "notes" TEXT,
  "created_by_id" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "invoice_clients_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "recurring_invoice_configs" (
  "id" UUID NOT NULL,
  "invoice_client_id" UUID NOT NULL,
  "billing_frequency" TEXT NOT NULL DEFAULT 'monthly',
  "billing_day" INTEGER NOT NULL DEFAULT 1,
  "monthly_items" JSONB NOT NULL DEFAULT '[]',
  "monthly_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "discount_percent" DECIMAL(5,2) NOT NULL DEFAULT 0,
  "due_date_rule" TEXT NOT NULL DEFAULT 'same_as_billing_day',
  "payment_details" TEXT,
  "status" "RecurringInvoiceStatus" NOT NULL DEFAULT 'active',
  "last_generated_month" DATE,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "recurring_invoice_configs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "invoice_notifications" (
  "id" UUID NOT NULL,
  "type" "InvoiceNotificationType" NOT NULL,
  "title" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "invoice_id" UUID,
  "invoice_client_id" UUID,
  "metadata" JSONB,
  "is_read" BOOLEAN NOT NULL DEFAULT false,
  "created_by_id" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "invoice_notifications_pkey" PRIMARY KEY ("id")
);

-- Backfill invoice clients from billing profiles + leads
INSERT INTO "invoice_clients" (
  "id", "client_name", "company_name", "contact_person", "email", "phone",
  "billing_address", "city", "country", "postal_code",
  "client_type", "billing_type", "notes", "created_by_id", "created_at", "updated_at"
)
SELECT
  cbp."id",
  COALESCE(NULLIF(cbp."bill_to_name", ''), NULLIF(l."contact", ''), l."company"),
  COALESCE(NULLIF(cbp."bill_to_company", ''), l."company"),
  COALESCE(NULLIF(cbp."bill_to_name", ''), l."contact"),
  NULL,
  l."phone",
  COALESCE(cbp."bill_to_line1", cbp."bill_to_line2"),
  cbp."bill_to_city",
  NULL,
  cbp."bill_to_postal",
  cbp."client_type",
  CASE
    WHEN cbp."is_monthly_retainer" THEN 'monthly_retainer'::"BillingType"
    ELSE 'one_time_development'::"BillingType"
  END,
  NULL,
  NULL,
  cbp."created_at",
  cbp."updated_at"
FROM "client_billing_profiles" cbp
JOIN "leads" l ON l."id" = cbp."lead_id";

-- Also create clients for invoices whose lead has no billing profile (edge case)
INSERT INTO "invoice_clients" (
  "id", "client_name", "company_name", "contact_person", "phone",
  "client_type", "billing_type", "created_at", "updated_at"
)
SELECT DISTINCT
  gen_random_uuid(),
  COALESCE(NULLIF(l."contact", ''), l."company"),
  l."company",
  l."contact",
  l."phone",
  'existing'::"ClientType",
  'one_time_development'::"BillingType",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "invoices" i
JOIN "leads" l ON l."id" = i."lead_id"
WHERE NOT EXISTS (
  SELECT 1 FROM "client_billing_profiles" cbp WHERE cbp."lead_id" = i."lead_id"
);

-- Prepare invoices for rewiring
ALTER TABLE "invoices"
  ADD COLUMN IF NOT EXISTS "invoice_type" "BillingType" NOT NULL DEFAULT 'one_time_development',
  ADD COLUMN IF NOT EXISTS "billing_month" DATE,
  ADD COLUMN IF NOT EXISTS "bill_to_country" TEXT,
  ADD COLUMN IF NOT EXISTS "show_savings_account" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "show_current_account" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "payment_details" TEXT,
  ADD COLUMN IF NOT EXISTS "sent_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "invoice_client_id" UUID;

UPDATE "invoices" i
SET
  "billing_month" = date_trunc('month', i."invoice_date")::date,
  "sent_at" = i."issued_at",
  "invoice_client_id" = COALESCE(
    (SELECT cbp."id" FROM "client_billing_profiles" cbp WHERE cbp."lead_id" = i."lead_id"),
    (
      SELECT ic."id"
      FROM "invoice_clients" ic
      JOIN "leads" l ON l."company" = ic."company_name"
      WHERE l."id" = i."lead_id"
      LIMIT 1
    )
  ),
  "invoice_type" = CASE
    WHEN EXISTS (
      SELECT 1 FROM "client_billing_profiles" cbp
      WHERE cbp."lead_id" = i."lead_id" AND cbp."is_monthly_retainer" = true
    ) THEN 'monthly_retainer'::"BillingType"
    ELSE 'one_time_development'::"BillingType"
  END;

-- Failsafe: any invoice still missing a client gets a synthetic one
INSERT INTO "invoice_clients" (
  "id", "client_name", "company_name", "client_type", "billing_type", "created_at", "updated_at"
)
SELECT
  gen_random_uuid(),
  COALESCE(i."bill_to_name", i."bill_to_company", 'Migrated Client'),
  COALESCE(i."bill_to_company", i."bill_to_name", 'Migrated Client'),
  COALESCE(i."client_type", 'existing'::"ClientType"),
  'one_time_development'::"BillingType",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "invoices" i
WHERE i."invoice_client_id" IS NULL;

UPDATE "invoices" i
SET "invoice_client_id" = (
  SELECT ic."id" FROM "invoice_clients" ic
  WHERE ic."company_name" = COALESCE(i."bill_to_company", i."bill_to_name", 'Migrated Client')
  ORDER BY ic."created_at" DESC
  LIMIT 1
)
WHERE i."invoice_client_id" IS NULL;

UPDATE "invoices"
SET "billing_month" = date_trunc('month', "invoice_date")::date
WHERE "billing_month" IS NULL;

ALTER TABLE "invoices"
  ALTER COLUMN "billing_month" SET NOT NULL,
  ALTER COLUMN "invoice_client_id" SET NOT NULL;

-- Recurring configs from enabled retainers
INSERT INTO "recurring_invoice_configs" (
  "id", "invoice_client_id", "billing_frequency", "billing_day",
  "monthly_items", "monthly_amount", "discount_percent",
  "due_date_rule", "status", "created_at", "updated_at"
)
SELECT
  gen_random_uuid(),
  cbp."id",
  'monthly',
  COALESCE(LEAST(GREATEST(cbp."billing_day_preference", 1), 28), 1),
  CASE
    WHEN cbp."package_description" IS NOT NULL THEN
      jsonb_build_array(
        jsonb_build_object(
          'description', cbp."package_description",
          'qty', COALESCE(cbp."package_qty", 1),
          'unitPrice', COALESCE(cbp."package_unit_price", 0)
        )
      )
    ELSE '[]'::jsonb
  END,
  COALESCE(cbp."package_unit_price", 0) * COALESCE(cbp."package_qty", 1),
  COALESCE(cbp."discount_percent", 0),
  'same_as_billing_day',
  CASE WHEN cbp."recurring_enabled" THEN 'active'::"RecurringInvoiceStatus" ELSE 'paused'::"RecurringInvoiceStatus" END,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "client_billing_profiles" cbp
WHERE cbp."is_monthly_retainer" = true;

ALTER TABLE "invoice_payments"
  ADD COLUMN IF NOT EXISTS "payment_method" TEXT,
  ADD COLUMN IF NOT EXISTS "reference_number" TEXT;

-- Drop old invoice FK/columns
ALTER TABLE "invoices" DROP CONSTRAINT IF EXISTS "invoices_lead_id_fkey";
ALTER TABLE "invoices" DROP CONSTRAINT IF EXISTS "invoices_billing_profile_id_fkey";
DROP INDEX IF EXISTS "invoices_lead_id_idx";

ALTER TABLE "invoices"
  DROP COLUMN IF EXISTS "lead_id",
  DROP COLUMN IF EXISTS "billing_profile_id",
  DROP COLUMN IF EXISTS "issued_at";

ALTER TABLE "invoice_clients"
  ADD CONSTRAINT "invoice_clients_created_by_id_fkey"
  FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "recurring_invoice_configs"
  ADD CONSTRAINT "recurring_invoice_configs_invoice_client_id_fkey"
  FOREIGN KEY ("invoice_client_id") REFERENCES "invoice_clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "invoices"
  ADD CONSTRAINT "invoices_invoice_client_id_fkey"
  FOREIGN KEY ("invoice_client_id") REFERENCES "invoice_clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "invoice_notifications"
  ADD CONSTRAINT "invoice_notifications_invoice_id_fkey"
  FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "invoice_notifications_invoice_client_id_fkey"
  FOREIGN KEY ("invoice_client_id") REFERENCES "invoice_clients"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "invoice_notifications_created_by_id_fkey"
  FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE UNIQUE INDEX "recurring_invoice_configs_invoice_client_id_key"
  ON "recurring_invoice_configs"("invoice_client_id");
CREATE INDEX "invoice_clients_company_name_idx" ON "invoice_clients"("company_name");
CREATE INDEX "invoice_clients_client_type_idx" ON "invoice_clients"("client_type");
CREATE INDEX "invoices_invoice_client_id_idx" ON "invoices"("invoice_client_id");
CREATE INDEX "invoices_billing_month_idx" ON "invoices"("billing_month");
CREATE INDEX "invoice_notifications_is_read_created_at_idx"
  ON "invoice_notifications"("is_read", "created_at");

-- One non-void invoice per client + billing month
CREATE UNIQUE INDEX "invoices_client_billing_month_nonvoid_key"
  ON "invoices"("invoice_client_id", "billing_month")
  WHERE "status" <> 'void';

-- Remove lead-tied billing profiles
DROP TABLE IF EXISTS "client_billing_profiles";
