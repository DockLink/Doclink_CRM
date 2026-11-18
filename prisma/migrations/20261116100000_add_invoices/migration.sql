-- CreateEnum
CREATE TYPE "ClientType" AS ENUM ('new', 'existing');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('draft', 'issued', 'paid', 'void');

-- AlterTable
ALTER TABLE "users" ADD COLUMN "can_access_invoices" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "company_invoice_settings" (
    "id" UUID NOT NULL,
    "company_name" TEXT NOT NULL DEFAULT 'DocLink',
    "company_phone" TEXT NOT NULL DEFAULT '+94 76 567 2814',
    "company_email" TEXT NOT NULL DEFAULT 'info@doclinkcare.com',
    "company_website" TEXT NOT NULL DEFAULT 'doclinkcare.com',
    "default_bank_name" TEXT NOT NULL DEFAULT 'HNB',
    "default_account_name" TEXT NOT NULL DEFAULT 'DocLink',
    "default_account_number" TEXT NOT NULL DEFAULT '188020074949',
    "terms_and_conditions" TEXT NOT NULL DEFAULT 'Payment — Payable by bank transfer before the billing month begins. Please use the invoice number as the payment reference.
Late Payment — If payment is not received by the due date, work is paused until it is received.
Taxes & Charges — No tax is applied to this invoice. Any bank transfer charges are to be covered by the payer.
Refunds — Payments are non-refundable as the service is ongoing and work begins on the start date, as set out in the Marketing Service Agreement.',
    "next_invoice_sequence" INTEGER NOT NULL DEFAULT 156,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_invoice_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_billing_profiles" (
    "id" UUID NOT NULL,
    "lead_id" UUID NOT NULL,
    "client_type" "ClientType" NOT NULL DEFAULT 'new',
    "bill_to_name" TEXT,
    "bill_to_company" TEXT,
    "bill_to_line1" TEXT,
    "bill_to_line2" TEXT,
    "bill_to_city" TEXT,
    "bill_to_postal" TEXT,
    "package_description" TEXT,
    "package_qty" INTEGER NOT NULL DEFAULT 1,
    "package_unit_price" DECIMAL(14,2),
    "currency" TEXT NOT NULL DEFAULT 'LKR',
    "bank_name" TEXT,
    "account_name" TEXT,
    "account_number" TEXT,
    "billing_day_preference" INTEGER,
    "discount_amount" DECIMAL(14,2),
    "discount_percent" DECIMAL(5,2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "client_billing_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" UUID NOT NULL,
    "invoice_number" TEXT,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'draft',
    "client_type" "ClientType" NOT NULL,
    "invoice_date" DATE NOT NULL,
    "due_date" DATE NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'LKR',
    "subtotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "discount_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "bill_to_name" TEXT,
    "bill_to_company" TEXT,
    "bill_to_line1" TEXT,
    "bill_to_line2" TEXT,
    "bill_to_city" TEXT,
    "bill_to_postal" TEXT,
    "bank_name" TEXT,
    "account_name" TEXT,
    "account_number" TEXT,
    "terms_and_conditions" TEXT,
    "reminder_dismissed_at" TIMESTAMP(3),
    "issued_at" TIMESTAMP(3),
    "paid_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "lead_id" UUID NOT NULL,
    "billing_profile_id" UUID NOT NULL,
    "created_by_id" UUID NOT NULL,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_line_items" (
    "id" UUID NOT NULL,
    "invoice_id" UUID NOT NULL,
    "description" TEXT NOT NULL,
    "qty" INTEGER NOT NULL DEFAULT 1,
    "unit_price" DECIMAL(14,2) NOT NULL,
    "total" DECIMAL(14,2) NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "invoice_line_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "client_billing_profiles_lead_id_key" ON "client_billing_profiles"("lead_id");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_invoice_number_key" ON "invoices"("invoice_number");

-- CreateIndex
CREATE INDEX "invoices_status_due_date_idx" ON "invoices"("status", "due_date");

-- CreateIndex
CREATE INDEX "invoices_lead_id_idx" ON "invoices"("lead_id");

-- CreateIndex
CREATE INDEX "invoices_due_date_idx" ON "invoices"("due_date");

-- CreateIndex
CREATE INDEX "invoice_line_items_invoice_id_idx" ON "invoice_line_items"("invoice_id");

-- AddForeignKey
ALTER TABLE "client_billing_profiles" ADD CONSTRAINT "client_billing_profiles_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_billing_profile_id_fkey" FOREIGN KEY ("billing_profile_id") REFERENCES "client_billing_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_line_items" ADD CONSTRAINT "invoice_line_items_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
