-- Restart invoice numbering at DL-YYYY-001
ALTER TABLE "company_invoice_settings" ALTER COLUMN "next_invoice_sequence" SET DEFAULT 1;
UPDATE "company_invoice_settings" SET "next_invoice_sequence" = 1;
