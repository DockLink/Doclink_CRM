import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, requireProfile, requireInvoiceAccess } from "@/lib/api-auth";
import {
  billingMonthFromDate,
  clientBillToSnapshot,
  computeInvoiceTotals,
  computeLineTotal,
  ensureCompanyInvoiceSettings,
  allocateInvoiceNumber,
  parseDateOnly,
  serializeInvoice,
  toNumber,
  validateDiscountPercent,
} from "@/lib/invoice-utils";

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

export async function GET(request: Request) {
  const limited = checkRateLimit(request, "invoices");
  if (limited) return limited;

  const { profile, response } = await requireProfile(request);
  if (response || !profile) return response ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const forbidden = requireInvoiceAccess(profile);
  if (forbidden) return forbidden;

  const url = new URL(request.url);
  const status = url.searchParams.get("status");
  const invoiceClientId = url.searchParams.get("invoiceClientId") ?? url.searchParams.get("clientId") ?? url.searchParams.get("leadId");
  const q = url.searchParams.get("q")?.trim();

  const clientScope = invoiceClientId ? { invoiceClientId } : {};
  const invoices = await prisma.invoice.findMany({
    where: {
      ...clientScope,
      ...(status && ["draft", "sent", "part_paid", "paid", "void"].includes(status)
        ? { status: status as "draft" | "sent" | "part_paid" | "paid" | "void" }
        : {}),
      ...(q
        ? {
            OR: [
              { invoiceNumber: { contains: q, mode: "insensitive" } },
              { billToCompany: { contains: q, mode: "insensitive" } },
              { billToName: { contains: q, mode: "insensitive" } },
              { invoiceClient: { companyName: { contains: q, mode: "insensitive" } } },
              { invoiceClient: { clientName: { contains: q, mode: "insensitive" } } },
            ],
          }
        : {}),
    },
    include: invoiceInclude,
    orderBy: [{ invoiceDate: "desc" }, { createdAt: "desc" }],
  });

  const today = new Date();
  const todayUtc = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
  const soon = new Date(todayUtc);
  soon.setUTCDate(soon.getUTCDate() + 3);

  const activeWhere = { ...clientScope, status: { not: "void" as const } };
  const [draft, sent, partPaid, paid, voided, overdue, dueSoon, totals] = await Promise.all([
    prisma.invoice.count({ where: { ...clientScope, status: "draft" } }),
    prisma.invoice.count({ where: { ...clientScope, status: "sent" } }),
    prisma.invoice.count({ where: { ...clientScope, status: "part_paid" } }),
    prisma.invoice.count({ where: { ...clientScope, status: "paid" } }),
    prisma.invoice.count({ where: { ...clientScope, status: "void" } }),
    prisma.invoice.count({ where: { ...clientScope, status: { in: ["sent", "part_paid"] }, dueDate: { lt: todayUtc } } }),
    prisma.invoice.count({
      where: {
        ...clientScope,
        status: { in: ["sent", "part_paid"] },
        dueDate: { gte: todayUtc, lte: soon },
      },
    }),
    prisma.invoice.aggregate({
      where: activeWhere,
      _sum: { total: true, amountPaid: true },
    }),
  ]);

  const totalInvoiced = toNumber(totals._sum.total);
  const totalPaid = toNumber(totals._sum.amountPaid);

  return NextResponse.json({
    invoices: invoices.map(serializeInvoice),
    kpis: {
      draft,
      sent,
      issued: sent,
      partPaid,
      paid,
      void: voided,
      overdue,
      dueSoon,
      total: draft + sent + partPaid + paid + voided,
      totalInvoiced: totalInvoiced.toFixed(2),
      totalPaid: totalPaid.toFixed(2),
      outstanding: Math.max(0, totalInvoiced - totalPaid).toFixed(2),
    },
  });
}

export async function POST(request: Request) {
  const limited = checkRateLimit(request, "invoices-write", 40);
  if (limited) return limited;

  const { profile, response } = await requireProfile(request);
  if (response || !profile) return response ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const forbidden = requireInvoiceAccess(profile);
  if (forbidden) return forbidden;

  const body = await request.json() as {
    invoiceClientId?: string;
    clientId?: string;
    leadId?: string;
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
    lineItems?: Array<{ description?: string; qty?: number; unitPrice?: string | number }>;
  };

  const invoiceClientId = (body.invoiceClientId ?? body.clientId ?? body.leadId)?.trim() ?? "";
  if (!invoiceClientId) {
    return NextResponse.json({ error: "invoiceClientId is required" }, { status: 400 });
  }

  const client = await prisma.invoiceClient.findUnique({ where: { id: invoiceClientId } });
  if (!client) return NextResponse.json({ error: "Invoice client not found" }, { status: 404 });

  const snapshot = clientBillToSnapshot(client);
  const clientType = body.clientType === "existing" || body.clientType === "new"
    ? body.clientType
    : client.clientType;
  const invoiceType = body.invoiceType
    ?? (client.billingType === "both" ? "monthly_retainer" : client.billingType);

  const billToName = body.billToName !== undefined ? (body.billToName?.trim() || null) : snapshot.billToName;
  const billToCompany = body.billToCompany !== undefined ? (body.billToCompany?.trim() || null) : snapshot.billToCompany;
  const billToLine1 = body.billToLine1 !== undefined ? (body.billToLine1?.trim() || null) : snapshot.billToLine1;
  const billToLine2 = body.billToLine2 !== undefined ? (body.billToLine2?.trim() || null) : snapshot.billToLine2;
  const billToCity = body.billToCity !== undefined ? (body.billToCity?.trim() || null) : snapshot.billToCity;
  const billToCountry = body.billToCountry !== undefined ? (body.billToCountry?.trim() || null) : snapshot.billToCountry;
  const billToPostal = body.billToPostal !== undefined ? (body.billToPostal?.trim() || null) : snapshot.billToPostal;

  const settings = await ensureCompanyInvoiceSettings();
  const invoiceDate = parseDateOnly(body.invoiceDate ?? "") ?? parseDateOnly(new Date())!;
  const dueDate = parseDateOnly(body.dueDate ?? "") ?? invoiceDate;
  const billingMonth = billingMonthFromDate(body.billingMonth ?? invoiceDate);
  if (!billingMonth) {
    return NextResponse.json({ error: "Invalid billing month" }, { status: 400 });
  }

  const lineItems = (body.lineItems ?? [])
    .map((item, index) => {
      const qty = Math.max(1, Number(item.qty) || 1);
      const unitPrice = toNumber(item.unitPrice);
      const description = item.description?.trim() ?? "";
      return {
        description,
        qty,
        unitPrice,
        total: computeLineTotal(qty, unitPrice),
        position: index,
      };
    })
    .filter((item) => item.description);

  if (lineItems.length === 0) {
    return NextResponse.json({ error: "Add at least one line item" }, { status: 400 });
  }

  const discountPercent = toNumber(body.discountPercent);
  const discountError = validateDiscountPercent(discountPercent);
  if (discountError) return NextResponse.json({ error: discountError }, { status: 400 });
  const totals = computeInvoiceTotals(lineItems, discountPercent);

  try {
    const created = await prisma.$transaction(async (tx) => {
      const invoiceNumber = await allocateInvoiceNumber(tx);
      return tx.invoice.create({
        data: {
          id: crypto.randomUUID(),
          invoiceNumber,
          status: "draft",
          clientType,
          invoiceType,
          invoiceDate,
          dueDate,
          billingMonth,
          currency: body.currency?.trim() || "LKR",
          subtotal: totals.subtotal,
          discountPercent: totals.discountPercent,
          discountAmount: totals.discountAmount,
          total: totals.total,
          billToName,
          billToCompany,
          billToLine1,
          billToLine2,
          billToCity,
          billToCountry,
          billToPostal,
          bankName: body.bankName?.trim() || settings.defaultBankName,
          accountName: body.accountName?.trim() || settings.defaultAccountName,
          accountNumber: body.accountNumber?.trim() || settings.defaultAccountNumber,
          paymentAccountType: body.paymentAccountType ?? null,
          showSavingsAccount: body.showSavingsAccount ?? true,
          showCurrentAccount: body.showCurrentAccount ?? true,
          paymentDetails: body.paymentDetails?.trim() || null,
          termsAndConditions: settings.termsAndConditions,
          invoiceClientId,
          createdById: profile.id,
          lineItems: {
            create: lineItems.map((item) => ({
              id: crypto.randomUUID(),
              description: item.description,
              qty: item.qty,
              unitPrice: item.unitPrice,
              total: item.total,
              position: item.position,
            })),
          },
        },
        include: invoiceInclude,
      });
    });

    return NextResponse.json({ invoice: serializeInvoice(created) }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create invoice";
    if (message.includes("invoices_client_billing_month_nonvoid_key") || message.includes("Unique constraint")) {
      return NextResponse.json(
        { error: "An invoice already exists for this client and billing month" },
        { status: 409 },
      );
    }
    throw error;
  }
}
