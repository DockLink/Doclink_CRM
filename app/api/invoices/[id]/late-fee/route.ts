import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, requireInvoiceAccess, requireProfile } from "@/lib/api-auth";
import { computeLineTotal, computeInvoiceTotals, serializeInvoice, toNumber } from "@/lib/invoice-utils";

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
  const limited = checkRateLimit(request, "invoice-late-fee", 30);
  if (limited) return limited;
  const { profile, response } = await requireProfile(request);
  if (response || !profile) return response ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const forbidden = requireInvoiceAccess(profile);
  if (forbidden) return forbidden;

  const { id } = await params;
  const body = await request.json() as { amount?: string | number; description?: string };
  const amount = toNumber(body.amount);
  if (amount <= 0) return NextResponse.json({ error: "Late fee amount must be greater than zero" }, { status: 400 });

  const source = await prisma.invoice.findUnique({ where: { id } });
  if (!source) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });

  const draft = await prisma.invoice.findFirst({
    where: { invoiceClientId: source.invoiceClientId, status: "draft" },
    include: { lineItems: true },
    orderBy: { invoiceDate: "asc" },
  });
  if (!draft) {
    return NextResponse.json({ error: "No draft invoice is available for this client" }, { status: 400 });
  }

  const feeItem = {
    description: body.description?.trim() || "Late fee",
    qty: 1,
    unitPrice: amount,
    total: computeLineTotal(1, amount),
    position: draft.lineItems.length,
  };
  const items = [
    ...draft.lineItems.map((item) => ({
      description: item.description,
      qty: item.qty,
      unitPrice: toNumber(item.unitPrice),
      total: toNumber(item.total),
      position: item.position,
    })),
    feeItem,
  ];
  const totals = computeInvoiceTotals(items, toNumber(draft.discountPercent));

  const updated = await prisma.$transaction(async (tx) => {
    await tx.invoiceLineItem.create({
      data: { id: crypto.randomUUID(), invoiceId: draft.id, ...feeItem },
    });
    return tx.invoice.update({
      where: { id: draft.id },
      data: {
        subtotal: totals.subtotal,
        discountAmount: totals.discountAmount,
        total: totals.total,
      },
      include: invoiceInclude,
    });
  });

  return NextResponse.json({ invoice: serializeInvoice(updated) });
}
