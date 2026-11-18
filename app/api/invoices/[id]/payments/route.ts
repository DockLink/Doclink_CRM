import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, requireInvoiceAccess, requireProfile } from "@/lib/api-auth";
import { calculateDaysLate, serializeInvoice, toNumber } from "@/lib/invoice-utils";

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
  const limited = checkRateLimit(request, "invoice-payment", 60);
  if (limited) return limited;
  const { profile, response } = await requireProfile(request);
  if (response || !profile) return response ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const forbidden = requireInvoiceAccess(profile);
  if (forbidden) return forbidden;

  const { id } = await params;
  const body = await request.json() as {
    amount?: string | number;
    paymentDate?: string;
    paymentMethod?: string;
    referenceNumber?: string;
    notes?: string;
  };
  const amount = toNumber(body.amount);
  const paymentDate = body.paymentDate ? new Date(`${body.paymentDate}T00:00:00.000Z`) : new Date();
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: "Payment amount must be greater than zero" }, { status: 400 });
  }
  if (Number.isNaN(paymentDate.getTime())) {
    return NextResponse.json({ error: "Invalid payment date" }, { status: 400 });
  }

  const invoice = await prisma.invoice.findUnique({ where: { id }, include: { payments: true } });
  if (!invoice) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  if (invoice.status === "draft" || invoice.status === "void") {
    return NextResponse.json({ error: "Only sent invoices can receive payments" }, { status: 400 });
  }
  const currentPaid = toNumber(invoice.amountPaid);
  const nextPaid = Math.round((currentPaid + amount) * 100) / 100;
  if (nextPaid > toNumber(invoice.total) + 0.001) {
    return NextResponse.json({ error: "Payment cannot exceed the invoice outstanding amount" }, { status: 400 });
  }

  const updated = await prisma.$transaction(async (tx) => {
    const daysLate = calculateDaysLate(invoice.dueDate, paymentDate);
    await tx.invoicePayment.create({
      data: {
        id: crypto.randomUUID(),
        invoiceId: id,
        amount,
        paymentDate,
        paymentMethod: body.paymentMethod?.trim() || null,
        referenceNumber: body.referenceNumber?.trim() || null,
        daysLate,
        notes: body.notes?.trim() || null,
        createdById: profile.id,
      },
    });
    const fullyPaid = nextPaid >= toNumber(invoice.total);
    return tx.invoice.update({
      where: { id },
      data: {
        amountPaid: nextPaid,
        status: fullyPaid ? "paid" : "part_paid",
        paidAt: fullyPaid ? paymentDate : null,
        daysLate,
      },
      include: invoiceInclude,
    });
  });

  return NextResponse.json({ invoice: serializeInvoice(updated) }, { status: 201 });
}
