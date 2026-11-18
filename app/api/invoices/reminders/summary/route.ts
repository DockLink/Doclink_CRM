import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, requireProfile, requireInvoiceAccess } from "@/lib/api-auth";
import { REMINDER_DAYS, serializeInvoice } from "@/lib/invoice-utils";

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
  const limited = checkRateLimit(request, "invoice-reminders");
  if (limited) return limited;

  const { profile, response } = await requireProfile(request);
  if (response || !profile) return response ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const forbidden = requireInvoiceAccess(profile);
  if (forbidden) return forbidden;

  const today = new Date();
  const todayUtc = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
  const soon = new Date(todayUtc);
  soon.setUTCDate(soon.getUTCDate() + REMINDER_DAYS);
  const recentDraftCutoff = new Date(todayUtc);
  recentDraftCutoff.setUTCDate(recentDraftCutoff.getUTCDate() - 14);

  const [openInvoices, recurringDrafts, unreadNotifications] = await Promise.all([
    prisma.invoice.findMany({
      where: {
        status: { in: ["sent", "part_paid"] },
        reminderDismissedAt: null,
      },
      include: invoiceInclude,
      orderBy: { dueDate: "asc" },
    }),
    prisma.invoice.findMany({
      where: {
        status: "draft",
        reminderDismissedAt: null,
        createdAt: { gte: recentDraftCutoff },
        invoiceType: { in: ["monthly_retainer", "both"] },
      },
      include: invoiceInclude,
      orderBy: { createdAt: "desc" },
    }),
    prisma.invoiceNotification.findMany({
      where: { isRead: false },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  const overdue = openInvoices.filter((invoice) => invoice.dueDate < todayUtc);
  const dueToday = openInvoices.filter((invoice) => {
    const due = invoice.dueDate;
    return due.getUTCFullYear() === todayUtc.getUTCFullYear()
      && due.getUTCMonth() === todayUtc.getUTCMonth()
      && due.getUTCDate() === todayUtc.getUTCDate();
  });
  const dueSoon = openInvoices.filter((invoice) => {
    const due = invoice.dueDate;
    const isToday = due.getUTCFullYear() === todayUtc.getUTCFullYear()
      && due.getUTCMonth() === todayUtc.getUTCMonth()
      && due.getUTCDate() === todayUtc.getUTCDate();
    return !isToday && due > todayUtc && due <= soon;
  });
  const reminders = openInvoices.filter((invoice) => {
    const due = invoice.dueDate;
    return due >= todayUtc && due <= soon;
  });

  return NextResponse.json({
    overdue: overdue.length,
    dueToday: dueToday.length,
    dueSoon: dueSoon.length,
    recurringDrafts: recurringDrafts.length,
    reminders: reminders.length,
    unreadNotifications: unreadNotifications.length,
    total: overdue.length + dueToday.length + dueSoon.length + recurringDrafts.length + unreadNotifications.length,
    notifications: unreadNotifications.map((item) => ({
      id: item.id,
      type: item.type,
      title: item.title,
      message: item.message,
      invoiceId: item.invoiceId,
      invoiceClientId: item.invoiceClientId,
      metadata: item.metadata,
      createdAt: item.createdAt.toISOString(),
    })),
    items: {
      overdue: overdue.map(serializeInvoice),
      dueToday: dueToday.map(serializeInvoice),
      dueSoon: dueSoon.map(serializeInvoice),
      recurringDrafts: recurringDrafts.map(serializeInvoice),
      reminders: reminders.map(serializeInvoice),
    },
  });
}
