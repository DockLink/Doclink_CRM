import { NextResponse } from "next/server";
import React from "react";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, requireProfile, requireInvoiceAccess } from "@/lib/api-auth";
import { ensureCompanyInvoiceSettings, money, toDateInput } from "@/lib/invoice-utils";
import { InvoicePdfDocument } from "@/lib/invoice-pdf";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  const limited = checkRateLimit(request, "invoice-pdf", 30);
  if (limited) return limited;

  const { profile, response } = await requireProfile(request);
  if (response || !profile) return response ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const forbidden = requireInvoiceAccess(profile);
  if (forbidden) return forbidden;

  const { id } = await params;
  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: { lineItems: { orderBy: { position: "asc" } } },
  });
  if (!invoice) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  if (invoice.status === "void") {
    return NextResponse.json({ error: "Voided invoices cannot be downloaded" }, { status: 400 });
  }

  const settings = await ensureCompanyInvoiceSettings();
  const paymentAccounts = await prisma.invoicePaymentAccount.findMany({
    where: { settingsId: settings.id, isActive: true },
    orderBy: { accountType: "asc" },
  });
  const invoiceNumber = invoice.invoiceNumber ?? "DRAFT";

  const buffer = await renderToBuffer(
    React.createElement(InvoicePdfDocument, {
      data: {
        invoiceNumber,
        invoiceDate: toDateInput(invoice.invoiceDate),
        dueDate: toDateInput(invoice.dueDate),
        currency: invoice.currency,
        subtotal: money(invoice.subtotal),
        discountPercent: money(invoice.discountPercent),
        discountAmount: money(invoice.discountAmount),
        total: money(invoice.total),
        billToName: invoice.billToName,
        billToCompany: invoice.billToCompany,
        billToLine1: invoice.billToLine1,
        billToLine2: invoice.billToLine2,
        billToCity: invoice.billToCity,
        billToPostal: invoice.billToPostal,
        bankName: invoice.bankName || settings.defaultBankName,
        accountName: invoice.accountName || settings.defaultAccountName,
        accountNumber: invoice.accountNumber || settings.defaultAccountNumber,
        paymentAccounts: paymentAccounts
          .filter((account) => {
            if (invoice.paymentAccountType) return account.accountType === invoice.paymentAccountType;
            if (account.accountType === "savings") return invoice.showSavingsAccount;
            if (account.accountType === "current") return invoice.showCurrentAccount;
            return true;
          })
          .map((account) => ({
            accountType: account.accountType,
            bankName: account.bankName,
            branch: account.branch,
            accountName: account.accountName,
            accountNumber: account.accountNumber,
          })),
        termsAndConditions: invoice.termsAndConditions || settings.termsAndConditions,
        companyName: settings.companyName,
        companyPhone: settings.companyPhone,
        companyEmail: settings.companyEmail,
        companyWebsite: settings.companyWebsite,
        lineItems: invoice.lineItems.map((item) => ({
          description: item.description,
          qty: item.qty,
          unitPrice: money(item.unitPrice),
          total: money(item.total),
        })),
      },
    }) as React.ReactElement<DocumentProps>,
  );

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${invoiceNumber}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
