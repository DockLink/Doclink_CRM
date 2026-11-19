ALTER TYPE "InvoiceStatus" ADD VALUE IF NOT EXISTS 'part_paid';

CREATE TYPE "InvoiceAccountType" AS ENUM ('savings', 'current');

ALTER TABLE "client_billing_profiles"
  ADD COLUMN "is_monthly_retainer" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "recurring_enabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "next_recurring_date" DATE;

ALTER TABLE "invoices"
  ADD COLUMN "discount_percent" DECIMAL(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN "amount_paid" DECIMAL(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN "days_late" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "payment_account_type" "InvoiceAccountType";

CREATE TABLE "invoice_payment_accounts" (
  "id" UUID NOT NULL,
  "settings_id" UUID NOT NULL,
  "account_type" "InvoiceAccountType" NOT NULL,
  "bank_name" TEXT NOT NULL,
  "account_name" TEXT NOT NULL,
  "account_number" TEXT NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "invoice_payment_accounts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "invoice_payments" (
  "id" UUID NOT NULL,
  "invoice_id" UUID NOT NULL,
  "amount" DECIMAL(14,2) NOT NULL,
  "payment_date" DATE NOT NULL,
  "days_late" INTEGER NOT NULL DEFAULT 0,
  "notes" TEXT,
  "created_by_id" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "invoice_payments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "invoice_payment_accounts_settings_id_account_type_key"
  ON "invoice_payment_accounts"("settings_id", "account_type");
CREATE INDEX "invoice_payments_invoice_id_payment_date_idx"
  ON "invoice_payments"("invoice_id", "payment_date");
ALTER TABLE "invoice_payment_accounts"
  ADD CONSTRAINT "invoice_payment_accounts_settings_id_fkey"
  FOREIGN KEY ("settings_id") REFERENCES "company_invoice_settings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "invoice_payments"
  ADD CONSTRAINT "invoice_payments_invoice_id_fkey"
  FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "invoice_payments"
  ADD CONSTRAINT "invoice_payments_created_by_id_fkey"
  FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
