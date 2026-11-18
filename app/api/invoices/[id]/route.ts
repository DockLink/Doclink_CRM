import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, requireProfile, requireInvoiceAccess } from "@/lib/api-auth";
import {
  billingMonthFromDate,
  computeInvoiceTotals,
  computeLineTotal,
  parseDateOnly,
  serializeInvoice,
  toNumber,
  validateDiscountPercent,
} from "@/lib/invoice-utils";

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

export async function GET(request: Request, { params }: Params) {
  const limited = checkRateLimit(request, "invoice-get");
  if (limited) return limited;

  const { profile, response } = await requireProfile(request);
  if (response || !profile) return response ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const forbidden = requireInvoiceAccess(profile);
  if (forbidden) return forbidden;

  const { id } = await params;
  const invoice = await prisma.invoice.findUnique({ where: { id }, include: invoiceInclude });
  if (!invoice) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  return NextResponse.json({ invoice: serializeInvoice(invoice) });
}

export async function PATCH(request: Request, { params }: Params) {
  const limited = checkRateLimit(request, "invoice-patch", 60);
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

  const body = await request.json() as {
    status?: "draft" | "sent" | "issued" | "part_paid" | "paid" | "void";
    clientType?: "new" | "existing";
    invoiceType?: "one_time_development" | "monthly_retainer" | "both";
    invoiceDate?: string;
    dueDate?: string;
    billingMonth?: string;
    currency?: string;
    discountPercent?: string | number;
    billToName?: string | null;
    billToCompany?: string | null;
    billToLine1?: string | null;
    billToLine2?: string | null;
    billToCity?: string | null;
    billToCountry?: string | null;
    billToPostal?: string | null;
    bankName?: string | null;
    accountName?: string | null;
    accountNumber?: string | null;
    paymentAccountType?: "savings" | "current" | null;
    showSavingsAccount?: boolean;
    showCurrentAccount?: boolean;
    paymentDetails?: string | null;
    reminderDismissedAt?: string | null;
    clearReminderDismissed?: boolean;
    lineItems?: Array<{ description?: string; qty?: number; unitPrice?: string | number }>;
  };

  if (body.clearReminderDismissed || body.reminderDismissedAt !== undefined) {
    const updated = await prisma.invoice.update({
      where: { id },
      data: {
        reminderDismissedAt: body.clearReminderDismissed
          ? null
          : body.reminderDismissedAt
            ? new Date(body.reminderDismissedAt)
            : new Date(),
      },
      include: invoiceInclude,
    });
    return NextResponse.json({ invoice: serializeInvoice(updated) });
  }

  if (body.status === "void") {
    if (existing.status === "paid") {
      return NextResponse.json({ error: "Paid invoices cannot be voided" }, { status: 400 });
    }
    const updated = await prisma.invoice.update({
      where: { id },
      data: { status: "void" },
      include: invoiceInclude,
    });
    return NextResponse.json({ invoice: serializeInvoice(updated) });
  }

  if (existing.status !== "draft") {
    return NextResponse.json({ error: "Only draft invoices can be edited" }, { status: 400 });
  }

  const data: Record<string, unknown> = {};
  if (body.clientType === "new" || body.clientType === "existing") data.clientType = body.clientType;
  if (body.invoiceType) data.invoiceType = body.invoiceType;
  if (body.invoiceDate !== undefined) {
    const parsed = parseDateOnly(body.invoiceDate);
    if (!parsed) return NextResponse.json({ error: "Invalid invoiceDate" }, { status: 400 });
    data.invoiceDate = parsed;
    data.billingMonth = billingMonthFromDate(parsed);
  }
  if (body.dueDate !== undefined) {
    const parsed = parseDateOnly(body.dueDate);
    if (!parsed) return NextResponse.json({ error: "Invalid dueDate" }, { status: 400 });
    data.dueDate = parsed;
  }
  if (body.billingMonth !== undefined) {
    const parsed = billingMonthFromDate(body.billingMonth);
    if (!parsed) return NextResponse.json({ error: "Invalid billingMonth" }, { status: 400 });
    data.billingMonth = parsed;
  }
  if (body.currency !== undefined) data.currency = body.currency.trim() || "LKR";
  if (body.billToName !== undefined) data.billToName = body.billToName?.trim() || null;
  if (body.billToCompany !== undefined) data.billToCompany = body.billToCompany?.trim() || null;
  if (body.billToLine1 !== undefined) data.billToLine1 = body.billToLine1?.trim() || null;
  if (body.billToLine2 !== undefined) data.billToLine2 = body.billToLine2?.trim() || null;
  if (body.billToCity !== undefined) data.billToCity = body.billToCity?.trim() || null;
  if (body.billToCountry !== undefined) data.billToCountry = body.billToCountry?.trim() || null;
  if (body.billToPostal !== undefined) data.billToPostal = body.billToPostal?.trim() || null;
  if (body.bankName !== undefined) data.bankName = body.bankName?.trim() || null;
  if (body.accountName !== undefined) data.accountName = body.accountName?.trim() || null;
  if (body.accountNumber !== undefined) data.accountNumber = body.accountNumber?.trim() || null;
  if (body.paymentAccountType === "savings" || body.paymentAccountType === "current" || body.paymentAccountType === null) {
    data.paymentAccountType = body.paymentAccountType;
  }
  if (body.showSavingsAccount !== undefined) data.showSavingsAccount = Boolean(body.showSavingsAccount);
  if (body.showCurrentAccount !== undefined) data.showCurrentAccount = Boolean(body.showCurrentAccount);
  if (body.paymentDetails !== undefined) data.paymentDetails = body.paymentDetails?.trim() || null;

  let lineItems = existing.lineItems.map((item) => ({
    description: item.description,
    qty: item.qty,
    unitPrice: toNumber(item.unitPrice),
    total: toNumber(item.total),
    position: item.position,
  }));

  if (body.lineItems) {
    lineItems = body.lineItems
      .map((item, index) => {
        const qty = Math.max(1, Number(item.qty) || 1);
        const unitPrice = toNumber(item.unitPrice);
        return {
          description: item.description?.trim() ?? "",
          qty,
          unitPrice,
          total: computeLineTotal(qty, unitPrice),
          position: index,
        };
      })
      .filter((item) => item.description);
    if (lineItems.length === 0) {
      return NextResponse.json({ error: "At least one line item is required" }, { status: 400 });
    }
  }

  const discountPercent = body.discountPercent !== undefined
    ? toNumber(body.discountPercent)
    : toNumber(existing.discountPercent);
  const discountError = validateDiscountPercent(discountPercent);
  if (discountError) return NextResponse.json({ error: discountError }, { status: 400 });
  const totals = computeInvoiceTotals(lineItems, discountPercent);
  data.subtotal = totals.subtotal;
  data.discountPercent = totals.discountPercent;
  data.discountAmount = totals.discountAmount;
  data.total = totals.total;

  try {
    const updated = await prisma.$transaction(async (tx) => {
      if (body.lineItems) {
        await tx.invoiceLineItem.deleteMany({ where: { invoiceId: id } });
        await tx.invoiceLineItem.createMany({
          data: lineItems.map((item) => ({
            id: crypto.randomUUID(),
            invoiceId: id,
            description: item.description,
            qty: item.qty,
            unitPrice: item.unitPrice,
            total: item.total,
            position: item.position,
          })),
        });
      }
      return tx.invoice.update({
        where: { id },
        data,
        include: invoiceInclude,
      });
    });
    return NextResponse.json({ invoice: serializeInvoice(updated) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update invoice";
    if (message.includes("Unique constraint") || message.includes("invoices_client_billing_month_nonvoid_key")) {
      return NextResponse.json(
        { error: "An invoice already exists for this client and billing month" },
        { status: 409 },
      );
    }
    throw error;
  }
}
