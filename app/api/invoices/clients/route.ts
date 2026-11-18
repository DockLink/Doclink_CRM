import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, requireProfile, requireInvoiceAccess } from "@/lib/api-auth";
import { money, serializeInvoiceClient, toNumber } from "@/lib/invoice-utils";

export async function GET(request: Request) {
  const limited = checkRateLimit(request, "invoice-clients");
  if (limited) return limited;

  const { profile, response } = await requireProfile(request);
  if (response || !profile) return response ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const forbidden = requireInvoiceAccess(profile);
  if (forbidden) return forbidden;

  const url = new URL(request.url);
  const q = url.searchParams.get("q")?.trim();

  const clients = await prisma.invoiceClient.findMany({
    where: q
      ? {
          OR: [
            { clientName: { contains: q, mode: "insensitive" } },
            { companyName: { contains: q, mode: "insensitive" } },
            { contactPerson: { contains: q, mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } },
          ],
        }
      : undefined,
    include: {
      recurringConfig: true,
      invoices: {
        select: { total: true, amountPaid: true, status: true },
      },
    },
    orderBy: { companyName: "asc" },
  });

  return NextResponse.json({
    clients: clients.map((client) => {
      const active = client.invoices.filter((invoice) => invoice.status !== "void");
      const totalBilled = active.reduce((sum, invoice) => sum + toNumber(invoice.total), 0);
      const totalPaid = active.reduce((sum, invoice) => sum + toNumber(invoice.amountPaid), 0);
      return {
        ...serializeInvoiceClient(client),
        id: client.id,
        company: client.companyName,
        contact: client.contactPerson,
        invoiceCount: client.invoices.length,
        totalBilled: money(totalBilled),
        totalPaid: money(totalPaid),
        totalOutstanding: money(Math.max(0, totalBilled - totalPaid)),
      };
    }),
  });
}

export async function POST(request: Request) {
  const limited = checkRateLimit(request, "invoice-clients-write", 40);
  if (limited) return limited;

  const { profile, response } = await requireProfile(request);
  if (response || !profile) return response ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const forbidden = requireInvoiceAccess(profile);
  if (forbidden) return forbidden;

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

  const clientName = body.clientName?.trim() ?? "";
  const companyName = body.companyName?.trim() ?? "";
  if (!clientName || !companyName) {
    return NextResponse.json({ error: "Client name and company name are required" }, { status: 400 });
  }

  const created = await prisma.invoiceClient.create({
    data: {
      id: crypto.randomUUID(),
      clientName,
      companyName,
      contactPerson: body.contactPerson?.trim() || null,
      email: body.email?.trim() || null,
      phone: body.phone?.trim() || null,
      billingAddress: body.billingAddress?.trim() || null,
      city: body.city?.trim() || null,
      country: body.country?.trim() || null,
      postalCode: body.postalCode?.trim() || null,
      clientType: body.clientType === "existing" ? "existing" : "new",
      billingType: body.billingType ?? "one_time_development",
      notes: body.notes?.trim() || null,
      createdById: profile.id,
    },
    include: { recurringConfig: true },
  });

  return NextResponse.json({ client: serializeInvoiceClient(created) }, { status: 201 });
}
