import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, requireInvoiceAccess, requireProfile } from "@/lib/api-auth";
import {
  allocateInvoiceNumber,
  billingMonthFromDate,
  clientBillToSnapshot,
  computeInvoiceTotals,
  computeLineTotal,
  formatBillingMonth,
  parseDateOnly,
  serializeInvoice,
  toNumber,
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

function addMonth(date: Date, day: number) {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1;
  const safeDay = Math.min(day, new Date(Date.UTC(year, month + 1, 0)).getUTCDate());
  return new Date(Date.UTC(year, month, safeDay));
}

function dateInMonth(date: Date, day: number) {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const safeDay = Math.min(day, new Date(Date.UTC(year, month + 1, 0)).getUTCDate());
  return new Date(Date.UTC(year, month, safeDay));
}

export async function POST(request: Request) {
  const limited = checkRateLimit(request, "invoice-recurring-generate", 10);
  if (limited) return limited;
  const { profile, response } = await requireProfile(request);
  if (response || !profile) return response ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const forbidden = requireInvoiceAccess(profile);
  if (forbidden) return forbidden;

  const configs = await prisma.recurringInvoiceConfig.findMany({
    where: { status: "active" },
    include: {
      invoiceClient: {
        include: {
          invoices: {
            where: { status: { not: "void" } },
            orderBy: { invoiceDate: "desc" },
            take: 1,
            include: { lineItems: true },
          },
        },
      },
    },
  });

  const today = parseDateOnly(new Date())!;
  const created = [];

  for (const config of configs) {
    const client = config.invoiceClient;
    const previous = client.invoices[0];
    const day = Math.min(Math.max(config.billingDay || 1, 1), 31);

    let nextDate: Date;
    if (previous) {
      nextDate = addMonth(previous.invoiceDate, day);
    } else {
      nextDate = dateInMonth(today, day);
      if (nextDate < today) nextDate = addMonth(today, day);
    }

    const readyDate = new Date(nextDate);
    readyDate.setUTCDate(readyDate.getUTCDate() - 5);
    if (today < readyDate) continue;

    const billingMonth = billingMonthFromDate(nextDate)!;
    const alreadyExists = await prisma.invoice.findFirst({
      where: {
        invoiceClientId: client.id,
        billingMonth,
        status: { not: "void" },
      },
      select: { id: true },
    });
    if (alreadyExists) continue;

    let items: Array<{ description: string; qty: number; unitPrice: number; total: number; position: number }>;
    let discountPercent = toNumber(config.discountPercent);

    if (previous?.lineItems?.length) {
      items = previous.lineItems.map((item, index) => ({
        description: item.description,
        qty: item.qty,
        unitPrice: toNumber(item.unitPrice),
        total: computeLineTotal(item.qty, toNumber(item.unitPrice)),
        position: index,
      }));
      discountPercent = toNumber(previous.discountPercent);
    } else {
      const templateItems = Array.isArray(config.monthlyItems) ? config.monthlyItems as Array<{
        description?: string;
        qty?: number;
        unitPrice?: number;
      }> : [];
      items = templateItems
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
      if (items.length === 0 && toNumber(config.monthlyAmount) > 0) {
        items = [{
          description: "Monthly retainer",
          qty: 1,
          unitPrice: toNumber(config.monthlyAmount),
          total: toNumber(config.monthlyAmount),
          position: 0,
        }];
      }
    }

    if (items.length === 0) {
      await prisma.invoiceNotification.create({
        data: {
          id: crypto.randomUUID(),
          type: "recurring_draft_failed",
          title: "Recurring invoice generation failed",
          message: `Could not generate draft for ${client.companyName}: no invoice items configured.`,
          invoiceClientId: client.id,
          metadata: { reason: "missing_items" },
          createdById: profile.id,
        },
      });
      continue;
    }

    const totals = computeInvoiceTotals(items, discountPercent);
    const snapshot = clientBillToSnapshot(client);

    try {
      const invoice = await prisma.$transaction(async (tx) => {
        const invoiceNumber = await allocateInvoiceNumber(tx);
        const draft = await tx.invoice.create({
          data: {
            id: crypto.randomUUID(),
            invoiceNumber,
            status: "draft",
            clientType: client.clientType,
            invoiceType: client.billingType === "one_time_development" ? "monthly_retainer" : client.billingType,
            invoiceDate: nextDate,
            dueDate: nextDate,
            billingMonth,
            currency: previous?.currency || "LKR",
            subtotal: totals.subtotal,
            discountPercent: totals.discountPercent,
            discountAmount: totals.discountAmount,
            total: totals.total,
            billToName: previous?.billToName || snapshot.billToName,
            billToCompany: previous?.billToCompany || snapshot.billToCompany,
            billToLine1: previous?.billToLine1 || snapshot.billToLine1,
            billToLine2: previous?.billToLine2 || snapshot.billToLine2,
            billToCity: previous?.billToCity || snapshot.billToCity,
            billToCountry: previous?.billToCountry || snapshot.billToCountry,
            billToPostal: previous?.billToPostal || snapshot.billToPostal,
            bankName: previous?.bankName,
            accountName: previous?.accountName,
            accountNumber: previous?.accountNumber,
            paymentAccountType: previous?.paymentAccountType,
            showSavingsAccount: previous?.showSavingsAccount ?? true,
            showCurrentAccount: previous?.showCurrentAccount ?? true,
            paymentDetails: previous?.paymentDetails || config.paymentDetails,
            termsAndConditions: previous?.termsAndConditions,
            invoiceClientId: client.id,
            createdById: profile.id,
            lineItems: {
              create: items.map((item) => ({ id: crypto.randomUUID(), ...item })),
            },
          },
          include: invoiceInclude,
        });

        await tx.recurringInvoiceConfig.update({
          where: { id: config.id },
          data: { lastGeneratedMonth: billingMonth },
        });

        await tx.invoiceNotification.create({
          data: {
            id: crypto.randomUUID(),
            type: "recurring_draft_created",
            title: "Recurring invoice draft generated",
            message: `${formatBillingMonth(billingMonth)} invoice draft for ${client.companyName} has been generated successfully. Please review and approve.`,
            invoiceId: draft.id,
            invoiceClientId: client.id,
            metadata: {
              invoiceNumber: draft.invoiceNumber,
              billingMonth: billingMonth.toISOString().slice(0, 10),
              amount: totals.total,
              clientName: client.companyName,
            },
            createdById: profile.id,
          },
        });

        return draft;
      });
      created.push(serializeInvoice(invoice));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      if (message.includes("Unique constraint") || message.includes("invoices_client_billing_month_nonvoid_key")) {
        continue;
      }
      await prisma.invoiceNotification.create({
        data: {
          id: crypto.randomUUID(),
          type: "recurring_draft_failed",
          title: "Recurring invoice generation failed",
          message: `Failed to generate draft for ${client.companyName}: ${message}`,
          invoiceClientId: client.id,
          metadata: { reason: message },
          createdById: profile.id,
        },
      });
    }
  }

  return NextResponse.json({ created });
}
