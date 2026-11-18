import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, requireProfile, requireInvoiceAccess } from "@/lib/api-auth";
import { serializeInvoice, toNumber } from "@/lib/invoice-utils";

type Params = { params: Promise<{ id: string }> };

const invoiceInclude = {
  invoiceClient: {
    select: {
      id: true,
      clientName: true,
      companyName: true,
      contactPerson: true,
      billingType: true,
    },
  },
  createdBy: { select: { id: true, name: true } },
  lineItems: { orderBy: { position: "asc" as const } },
  payments: { orderBy: { paymentDate: "asc" as const } },
};

export async function POST(request: Request, { params }: Params) {
  const limited = checkRateLimit(request, "invoice-issue", 30);
  if (limited) return limited;

  const { profile, response } = await requireProfile(request);
  if (response || !profile) return response ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const forbidden = requireInvoiceAccess(profile);
  if (forbidden) return forbidden;

  const { id } = await params;
  const existing = await prisma.invoice.findUnique({
    where: { id },
    include: { lineItems: true },
  });
  if (!existing) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  if (existing.status !== "draft") {
    return NextResponse.json({ error: "Only draft invoices can be sent" }, { status: 400 });
  }
  if (existing.lineItems.length === 0) {
    return NextResponse.json({ error: "Add line items before sending" }, { status: 400 });
  }
  if (
    !existing.billToName?.trim()
    || !existing.billToCompany?.trim()
    || !existing.billToLine1?.trim()
  ) {
    return NextResponse.json(
      { error: "Complete Name, Company, and Address before sending" },
      { status: 400 },
    );
  }
  if (toNumber(existing.total) <= 0) {
    return NextResponse.json({ error: "Invoice total must be greater than zero" }, { status: 400 });
  }

  const sent = await prisma.$transaction(async (tx) => {
    const settings = await tx.companyInvoiceSettings.findFirst({ orderBy: { updatedAt: "asc" } });
    const ensured = settings ?? await tx.companyInvoiceSettings.create({ data: { id: crypto.randomUUID() } });
    return tx.invoice.update({
      where: { id },
      data: {
        status: "sent",
        sentAt: new Date(),
        bankName: existing.bankName || ensured.defaultBankName,
        accountName: existing.accountName || ensured.defaultAccountName,
        accountNumber: existing.accountNumber || ensured.defaultAccountNumber,
        termsAndConditions: existing.termsAndConditions || ensured.termsAndConditions,
      },
      include: invoiceInclude,
    });
  });

  return NextResponse.json({ invoice: serializeInvoice(sent) });
}
