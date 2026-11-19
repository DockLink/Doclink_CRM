import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, requireInvoiceAccess, requireProfile } from "@/lib/api-auth";
import { money, toNumber } from "@/lib/invoice-utils";

export async function GET(request: Request) {
  const limited = checkRateLimit(request, "invoice-recurring-list");
  if (limited) return limited;
  const { profile, response } = await requireProfile(request);
  if (response || !profile) return response ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const forbidden = requireInvoiceAccess(profile);
  if (forbidden) return forbidden;

  const configs = await prisma.recurringInvoiceConfig.findMany({
    include: {
      invoiceClient: {
        select: { id: true, companyName: true, clientName: true, contactPerson: true },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json({
    configs: configs.map((config) => ({
      id: config.id,
      invoiceClientId: config.invoiceClientId,
      billingFrequency: config.billingFrequency,
      billingDay: config.billingDay,
      monthlyAmount: money(config.monthlyAmount),
      discountPercent: money(config.discountPercent),
      dueDateRule: config.dueDateRule,
      paymentDetails: config.paymentDetails,
      status: config.status,
      lastGeneratedMonth: config.lastGeneratedMonth?.toISOString().slice(0, 10) ?? null,
      monthlyItems: config.monthlyItems,
      client: config.invoiceClient,
    })),
  });
}

export async function POST(request: Request) {
  const limited = checkRateLimit(request, "invoice-recurring-write", 40);
  if (limited) return limited;
  const { profile, response } = await requireProfile(request);
  if (response || !profile) return response ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const forbidden = requireInvoiceAccess(profile);
  if (forbidden) return forbidden;

  const body = await request.json() as {
    invoiceClientId?: string;
    billingDay?: number;
    monthlyAmount?: string | number;
    discountPercent?: string | number;
    paymentDetails?: string | null;
    status?: "active" | "paused";
    monthlyItems?: Array<{ description?: string; qty?: number; unitPrice?: number }>;
  };

  const invoiceClientId = body.invoiceClientId?.trim() ?? "";
  if (!invoiceClientId) {
    return NextResponse.json({ error: "invoiceClientId is required" }, { status: 400 });
  }
  const client = await prisma.invoiceClient.findUnique({ where: { id: invoiceClientId } });
  if (!client) return NextResponse.json({ error: "Invoice client not found" }, { status: 404 });

  const billingDay = Math.min(Math.max(Math.floor(body.billingDay || 1), 1), 31);
  const monthlyItems = (body.monthlyItems ?? [])
    .filter((item) => item.description?.trim())
    .map((item) => ({
      description: item.description!.trim(),
      qty: Math.max(1, Number(item.qty) || 1),
      unitPrice: toNumber(item.unitPrice),
    }));

  const config = await prisma.recurringInvoiceConfig.upsert({
    where: { invoiceClientId },
    create: {
      id: crypto.randomUUID(),
      invoiceClientId,
      billingDay,
      monthlyAmount: toNumber(body.monthlyAmount),
      discountPercent: toNumber(body.discountPercent),
      paymentDetails: body.paymentDetails?.trim() || null,
      status: body.status === "paused" ? "paused" : "active",
      monthlyItems,
    },
    update: {
      billingDay,
      ...(body.monthlyAmount !== undefined ? { monthlyAmount: toNumber(body.monthlyAmount) } : {}),
      ...(body.discountPercent !== undefined ? { discountPercent: toNumber(body.discountPercent) } : {}),
      ...(body.paymentDetails !== undefined ? { paymentDetails: body.paymentDetails?.trim() || null } : {}),
      ...(body.status ? { status: body.status } : {}),
      ...(body.monthlyItems ? { monthlyItems } : {}),
    },
    include: {
      invoiceClient: {
        select: { id: true, companyName: true, clientName: true, contactPerson: true },
      },
    },
  });

  return NextResponse.json({
    config: {
      id: config.id,
      invoiceClientId: config.invoiceClientId,
      billingDay: config.billingDay,
      monthlyAmount: money(config.monthlyAmount),
      discountPercent: money(config.discountPercent),
      status: config.status,
      paymentDetails: config.paymentDetails,
      monthlyItems: config.monthlyItems,
      client: config.invoiceClient,
    },
  }, { status: 201 });
}
