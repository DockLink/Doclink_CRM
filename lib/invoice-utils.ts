import { prisma } from "@/lib/prisma";
import {
  money,
  toDateInput,
  effectiveDisplayStatus,
  calculateDaysOverdue,
  toNumber,
  billingMonthFromDate,
  billingTypeLabel,
  type Decimalish,
} from "@/lib/invoice-format";

export * from "@/lib/invoice-format";

export async function ensureCompanyInvoiceSettings() {
  const existing = await prisma.companyInvoiceSettings.findFirst({ orderBy: { updatedAt: "asc" } });
  if (existing) return existing;
  return prisma.companyInvoiceSettings.create({
    data: { id: crypto.randomUUID() },
  });
}

export function serializeInvoiceClient(client: {
  id: string;
  clientName: string;
  companyName: string;
  contactPerson: string | null;
  email: string | null;
  phone: string | null;
  billingAddress: string | null;
  city: string | null;
  country: string | null;
  postalCode: string | null;
  clientType: "new" | "existing";
  billingType: "one_time_development" | "monthly_retainer" | "both";
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  recurringConfig?: {
    id: string;
    billingDay: number;
    status: "active" | "paused";
    monthlyAmount: Decimalish;
    discountPercent: Decimalish;
  } | null;
}) {
  return {
    id: client.id,
    clientName: client.clientName,
    companyName: client.companyName,
    contactPerson: client.contactPerson,
    email: client.email,
    phone: client.phone,
    billingAddress: client.billingAddress,
    city: client.city,
    country: client.country,
    postalCode: client.postalCode,
    clientType: client.clientType,
    billingType: client.billingType,
    billingTypeLabel: billingTypeLabel(client.billingType),
    notes: client.notes,
    createdAt: client.createdAt.toISOString(),
    updatedAt: client.updatedAt.toISOString(),
    recurringConfig: client.recurringConfig
      ? {
          id: client.recurringConfig.id,
          billingDay: client.recurringConfig.billingDay,
          status: client.recurringConfig.status,
          monthlyAmount: money(client.recurringConfig.monthlyAmount),
          discountPercent: money(client.recurringConfig.discountPercent),
        }
      : null,
  };
}

export function serializeInvoice(invoice: {
  id: string;
  invoiceNumber: string | null;
  status: "draft" | "sent" | "part_paid" | "paid" | "void";
  clientType: "new" | "existing";
  invoiceType: "one_time_development" | "monthly_retainer" | "both";
  invoiceDate: Date;
  dueDate: Date;
  billingMonth: Date;
  currency: string;
  subtotal: Decimalish;
  discountAmount: Decimalish;
  discountPercent: Decimalish;
  total: Decimalish;
  amountPaid: Decimalish;
  daysLate: number;
  billToName: string | null;
  billToCompany: string | null;
  billToLine1: string | null;
  billToLine2: string | null;
  billToCity: string | null;
  billToCountry?: string | null;
  billToPostal: string | null;
  bankName: string | null;
  accountName: string | null;
  accountNumber: string | null;
  paymentAccountType: "savings" | "current" | null;
  showSavingsAccount?: boolean;
  showCurrentAccount?: boolean;
  paymentDetails?: string | null;
  termsAndConditions: string | null;
  reminderDismissedAt: Date | null;
  sentAt: Date | null;
  paidAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  invoiceClientId: string;
  createdById: string;
  invoiceClient?: {
    id: string;
    clientName: string;
    companyName: string;
    contactPerson: string | null;
    billingType?: "one_time_development" | "monthly_retainer" | "both";
  };
  createdBy?: { id: string; name: string };
  lineItems?: Array<{
    id: string;
    description: string;
    qty: number;
    unitPrice: Decimalish;
    total: Decimalish;
    position: number;
  }>;
  payments?: Array<{
    id: string;
    amount: Decimalish;
    paymentDate: Date;
    paymentMethod?: string | null;
    referenceNumber?: string | null;
    daysLate: number;
    notes: string | null;
    createdAt: Date;
  }>;
}) {
  const displayStatus = effectiveDisplayStatus(invoice.status, invoice.dueDate);
  const outstanding = Math.max(0, toNumber(invoice.total) - toNumber(invoice.amountPaid));
  const runningDaysLate = outstanding > 0 && displayStatus === "overdue"
    ? calculateDaysOverdue(invoice.dueDate)
    : invoice.daysLate;
  const isMonthlyRetainer = invoice.invoiceType === "monthly_retainer" || invoice.invoiceType === "both";
  return {
    id: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    status: invoice.status,
    displayStatus,
    clientType: invoice.clientType,
    invoiceType: billingTypeLabel(invoice.invoiceType),
    invoiceTypeValue: invoice.invoiceType,
    isMonthlyRetainer,
    invoiceDate: toDateInput(invoice.invoiceDate),
    dueDate: toDateInput(invoice.dueDate),
    billingMonth: toDateInput(invoice.billingMonth),
    currency: invoice.currency,
    subtotal: money(invoice.subtotal),
    discountPercent: money(invoice.discountPercent),
    discountAmount: money(invoice.discountAmount),
    total: money(invoice.total),
    amountPaid: money(invoice.amountPaid),
    outstanding: money(outstanding),
    daysLate: runningDaysLate,
    billToName: invoice.billToName,
    billToCompany: invoice.billToCompany,
    billToLine1: invoice.billToLine1,
    billToLine2: invoice.billToLine2,
    billToCity: invoice.billToCity,
    billToCountry: invoice.billToCountry ?? null,
    billToPostal: invoice.billToPostal,
    bankName: invoice.bankName,
    accountName: invoice.accountName,
    accountNumber: invoice.accountNumber,
    paymentAccountType: invoice.paymentAccountType,
    showSavingsAccount: invoice.showSavingsAccount ?? true,
    showCurrentAccount: invoice.showCurrentAccount ?? true,
    paymentDetails: invoice.paymentDetails ?? null,
    termsAndConditions: invoice.termsAndConditions,
    reminderDismissedAt: invoice.reminderDismissedAt?.toISOString() ?? null,
    sentAt: invoice.sentAt?.toISOString() ?? null,
    issuedAt: invoice.sentAt?.toISOString() ?? null,
    paidAt: invoice.paidAt?.toISOString() ?? null,
    createdAt: invoice.createdAt.toISOString(),
    updatedAt: invoice.updatedAt.toISOString(),
    invoiceClientId: invoice.invoiceClientId,
    leadId: invoice.invoiceClientId,
    createdById: invoice.createdById,
    invoiceClient: invoice.invoiceClient
      ? {
          id: invoice.invoiceClient.id,
          clientName: invoice.invoiceClient.clientName,
          companyName: invoice.invoiceClient.companyName,
          contactPerson: invoice.invoiceClient.contactPerson,
          billingType: invoice.invoiceClient.billingType,
        }
      : undefined,
    lead: invoice.invoiceClient
      ? {
          id: invoice.invoiceClient.id,
          company: invoice.invoiceClient.companyName,
          contact: invoice.invoiceClient.contactPerson,
        }
      : undefined,
    createdBy: invoice.createdBy
      ? { id: invoice.createdBy.id, name: invoice.createdBy.name }
      : undefined,
    lineItems: (invoice.lineItems ?? []).map((item) => ({
      id: item.id,
      description: item.description,
      qty: item.qty,
      unitPrice: money(item.unitPrice),
      total: money(item.total),
      position: item.position,
    })),
    payments: (invoice.payments ?? []).map((payment) => ({
      id: payment.id,
      amount: money(payment.amount),
      paymentDate: toDateInput(payment.paymentDate),
      paymentMethod: payment.paymentMethod ?? null,
      referenceNumber: payment.referenceNumber ?? null,
      daysLate: payment.daysLate,
      notes: payment.notes,
      createdAt: payment.createdAt.toISOString(),
    })),
  };
}

export function clientBillToSnapshot(client: {
  clientName: string;
  companyName: string;
  billingAddress: string | null;
  city: string | null;
  country: string | null;
  postalCode: string | null;
  contactPerson: string | null;
}) {
  return {
    billToName: client.contactPerson || client.clientName,
    billToCompany: client.companyName,
    billToLine1: client.billingAddress,
    billToLine2: null as string | null,
    billToCity: client.city,
    billToCountry: client.country,
    billToPostal: client.postalCode,
  };
}

export async function allocateInvoiceNumber(tx: {
  companyInvoiceSettings: {
    findFirst: Function;
    create: Function;
    updateMany: Function;
  };
}, year = new Date().getUTCFullYear()) {
  let settings = await tx.companyInvoiceSettings.findFirst({ orderBy: { updatedAt: "asc" } });
  if (!settings) {
    settings = await tx.companyInvoiceSettings.create({ data: { id: crypto.randomUUID() } });
  }
  while (true) {
    const sequence = settings.nextInvoiceSequence;
    const changed = await tx.companyInvoiceSettings.updateMany({
      where: { id: settings.id, nextInvoiceSequence: sequence },
      data: { nextInvoiceSequence: sequence + 1 },
    });
    if (changed.count === 1) return `DL-${year}-${String(sequence).padStart(3, "0")}`;
    settings = await tx.companyInvoiceSettings.findFirst({ where: { id: settings.id } });
    if (!settings) throw new Error("Invoice number sequence settings are unavailable");
  }
}

export { billingMonthFromDate };
