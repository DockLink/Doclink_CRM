import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, requireInvoiceAccess, requireProfile } from "@/lib/api-auth";
import { serializeInvoice, serializeInvoiceClient, toNumber } from "@/lib/invoice-utils";
import { isValidClientPhone } from "@/lib/client-form-validation";

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
  const limited = checkRateLimit(request, "invoice-client-folder");
  if (limited) return limited;
  const { profile, response } = await requireProfile(request);
  if (response || !profile) return response ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const forbidden = requireInvoiceAccess(profile);
  if (forbidden) return forbidden;

  const { id } = await params;
  const url = new URL(request.url);
  const filter = url.searchParams.get("filter");
  const year = Number(url.searchParams.get("year"));

  const client = await prisma.invoiceClient.findUnique({
    where: { id },
    include: { recurringConfig: true },
  });
  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  const invoices = await prisma.invoice.findMany({
    where: {
      invoiceClientId: id,
      ...(Number.isInteger(year) && year > 2000
        ? {
            billingMonth: {
              gte: new Date(Date.UTC(year, 0, 1)),
              lt: new Date(Date.UTC(year + 1, 0, 1)),
            },
          }
        : {}),
    },
    include: invoiceInclude,
    orderBy: [{ invoiceDate: "desc" }, { createdAt: "desc" }],
  });

  const today = new Date();
  const todayUtc = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
  const serialized = invoices.map(serializeInvoice);
  const filtered = serialized.filter((invoice) => {
    const paid = toNumber(invoice.amountPaid) >= toNumber(invoice.total);
    const overdue = invoice.displayStatus === "overdue"
      || (!paid && invoice.status !== "draft" && invoice.status !== "void" && invoice.dueDate < todayUtc.toISOString().slice(0, 10));
    if (filter === "paid") return paid;
    if (filter === "unpaid") return !paid && invoice.status !== "void";
    if (filter === "overdue") return overdue;
    return true;
  });

  const active = invoices.filter((invoice) => invoice.status !== "void");
  const totalBilled = active.reduce((sum, invoice) => sum + toNumber(invoice.total), 0);
  const totalPaid = active.reduce((sum, invoice) => sum + toNumber(invoice.amountPaid), 0);
  const totalLateDays = serialized.reduce((sum, invoice) => sum + invoice.daysLate, 0);

  return NextResponse.json({
    client: {
      ...serializeInvoiceClient(client),
      id: client.id,
      company: client.companyName,
      contact: client.contactPerson,
    },
    summary: {
      totalBilled: totalBilled.toFixed(2),
      totalPaid: totalPaid.toFixed(2),
      totalOutstanding: Math.max(0, totalBilled - totalPaid).toFixed(2),
      totalLateDays,
    },
    invoices: filtered,
    years: [...new Set(invoices.map((invoice) => invoice.billingMonth.getUTCFullYear()))].sort((a, b) => b - a),
  });
}

export async function PATCH(request: Request, { params }: Params) {
  const limited = checkRateLimit(request, "invoice-client-write", 40);
  if (limited) return limited;
  const { profile, response } = await requireProfile(request);
  if (response || !profile) return response ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const forbidden = requireInvoiceAccess(profile);
  if (forbidden) return forbidden;

  const { id } = await params;
  const existing = await prisma.invoiceClient.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  const body = await request.json() as {
    clientName?: string;
    companyName?: string;
    contactPerson?: string | null;
    email?: string | null;
    phone?: string | null;
    billingAddress?: string | null;
    city?: string | null;
    country?: string | null;
    postalCode?: string | null;
    clientType?: "new" | "existing";
    billingType?: "one_time_development" | "monthly_retainer" | "both";
    notes?: string | null;
  };

  if (body.clientName !== undefined && !body.clientName.trim()) {
    return NextResponse.json({ error: "Client name is required" }, { status: 400 });
  }
  if (body.companyName !== undefined && !body.companyName.trim()) {
    return NextResponse.json({ error: "Company name is required" }, { status: 400 });
  }
  if (body.billingAddress !== undefined && !body.billingAddress?.trim()) {
    return NextResponse.json({ error: "Billing address is required" }, { status: 400 });
  }
  if (body.city !== undefined && !body.city?.trim()) {
    return NextResponse.json({ error: "City is required" }, { status: 400 });
  }
  if (body.phone !== undefined && !body.phone?.trim()) {
    return NextResponse.json({ error: "Telephone number is required" }, { status: 400 });
  }
  if (body.phone?.trim() && !isValidClientPhone(body.phone)) {
    return NextResponse.json({ error: "Enter a valid Sri Lankan or international phone number." }, { status: 400 });
  }

  const updated = await prisma.invoiceClient.update({
    where: { id },
    data: {
      ...(body.clientName !== undefined ? { clientName: body.clientName.trim() } : {}),
      ...(body.companyName !== undefined ? { companyName: body.companyName.trim() } : {}),
      ...(body.contactPerson !== undefined ? { contactPerson: body.contactPerson?.trim() || null } : {}),
      ...(body.email !== undefined ? { email: body.email?.trim() || null } : {}),
      ...(body.phone !== undefined ? { phone: body.phone?.trim() || null } : {}),
      ...(body.billingAddress !== undefined ? { billingAddress: body.billingAddress?.trim() || null } : {}),
      ...(body.city !== undefined ? { city: body.city?.trim() || null } : {}),
      ...(body.country !== undefined ? { country: body.country?.trim() || null } : {}),
      ...(body.postalCode !== undefined ? { postalCode: body.postalCode?.trim() || null } : {}),
      ...(body.clientType === "new" || body.clientType === "existing" ? { clientType: body.clientType } : {}),
      ...(body.billingType ? { billingType: body.billingType } : {}),
      ...(body.notes !== undefined ? { notes: body.notes?.trim() || null } : {}),
    },
    include: { recurringConfig: true },
  });

  return NextResponse.json({ client: serializeInvoiceClient(updated) });
}
