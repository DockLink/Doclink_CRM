import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, requireProfile, requireRole } from "@/lib/api-auth";
import { ensureCompanyInvoiceSettings } from "@/lib/invoice-utils";

function serializeSettings(settings: {
  id: string;
  companyName: string;
  companyPhone: string;
  companyEmail: string;
  companyWebsite: string;
  defaultBankName: string;
  defaultAccountName: string;
  defaultAccountNumber: string;
  termsAndConditions: string;
  nextInvoiceSequence: number;
  updatedAt: Date;
  paymentAccounts?: Array<{
    id: string;
    accountType: "savings" | "current";
    bankName: string;
    branch?: string | null;
    accountName: string;
    accountNumber: string;
    isActive: boolean;
  }>;
}) {
  return {
    id: settings.id,
    companyName: settings.companyName,
    companyPhone: settings.companyPhone,
    companyEmail: settings.companyEmail,
    companyWebsite: settings.companyWebsite,
    defaultBankName: settings.defaultBankName,
    defaultAccountName: settings.defaultAccountName,
    defaultAccountNumber: settings.defaultAccountNumber,
    termsAndConditions: settings.termsAndConditions,
    nextInvoiceSequence: settings.nextInvoiceSequence,
    updatedAt: settings.updatedAt.toISOString(),
    paymentAccounts: (settings.paymentAccounts ?? []).map((account) => ({
      id: account.id,
      accountType: account.accountType,
      bankName: account.bankName,
      branch: account.branch ?? null,
      accountName: account.accountName,
      accountNumber: account.accountNumber,
      isActive: account.isActive,
    })),
  };
}

export async function GET(request: Request) {
  const limited = checkRateLimit(request, "invoice-settings");
  if (limited) return limited;

  const { profile, response } = await requireProfile(request);
  if (response || !profile) return response ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (profile.role !== "superadmin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const settings = await prisma.companyInvoiceSettings.findFirst({
    orderBy: { updatedAt: "asc" },
    include: { paymentAccounts: true },
  }) ?? await ensureCompanyInvoiceSettings();
  return NextResponse.json({ settings: serializeSettings(settings) });
}

export async function PATCH(request: Request) {
  const limited = checkRateLimit(request, "invoice-settings-write", 30);
  if (limited) return limited;

  const { profile, response } = await requireProfile(request);
  if (response || !profile) return response ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const forbidden = requireRole(profile, "superadmin");
  if (forbidden) return forbidden;

  const settings = await ensureCompanyInvoiceSettings();
  const body = await request.json() as {
    companyName?: string;
    companyPhone?: string;
    companyEmail?: string;
    companyWebsite?: string;
    defaultBankName?: string;
    defaultAccountName?: string;
    defaultAccountNumber?: string;
    termsAndConditions?: string;
    nextInvoiceSequence?: number;
    paymentAccounts?: Array<{
      accountType: "savings" | "current";
      bankName: string;
      branch?: string | null;
      accountName: string;
      accountNumber: string;
      isActive?: boolean;
    }>;
  };

  const updated = await prisma.$transaction(async (tx) => {
    const updatedSettings = await tx.companyInvoiceSettings.update({
      where: { id: settings.id },
      data: {
      ...(body.companyName !== undefined ? { companyName: body.companyName.trim() || "DocLink" } : {}),
      ...(body.companyPhone !== undefined ? { companyPhone: body.companyPhone.trim() } : {}),
      ...(body.companyEmail !== undefined ? { companyEmail: body.companyEmail.trim() } : {}),
      ...(body.companyWebsite !== undefined ? { companyWebsite: body.companyWebsite.trim() } : {}),
      ...(body.defaultBankName !== undefined ? { defaultBankName: body.defaultBankName.trim() } : {}),
      ...(body.defaultAccountName !== undefined ? { defaultAccountName: body.defaultAccountName.trim() } : {}),
      ...(body.defaultAccountNumber !== undefined ? { defaultAccountNumber: body.defaultAccountNumber.trim() } : {}),
      ...(body.termsAndConditions !== undefined ? { termsAndConditions: body.termsAndConditions.trim() } : {}),
      ...(body.nextInvoiceSequence !== undefined
        ? { nextInvoiceSequence: Math.max(1, Math.floor(Number(body.nextInvoiceSequence) || 1)) }
        : {}),
      },
      include: { paymentAccounts: true },
    });
    if (body.paymentAccounts) {
      for (const account of body.paymentAccounts) {
        if (!["savings", "current"].includes(account.accountType)
          || !account.bankName.trim()
          || !account.accountName.trim()
          || !account.accountNumber.trim()) {
          throw new Error("Each payment account requires a valid type, bank, name, and number");
        }
        await tx.invoicePaymentAccount.upsert({
          where: { settingsId_accountType: { settingsId: settings.id, accountType: account.accountType } },
          create: {
            id: crypto.randomUUID(),
            settingsId: settings.id,
            accountType: account.accountType,
            bankName: account.bankName.trim(),
            branch: account.branch?.trim() || null,
            accountName: account.accountName.trim(),
            accountNumber: account.accountNumber.trim(),
            isActive: account.isActive !== false,
          },
          update: {
            bankName: account.bankName.trim(),
            branch: account.branch?.trim() || null,
            accountName: account.accountName.trim(),
            accountNumber: account.accountNumber.trim(),
            isActive: account.isActive !== false,
          },
        });
      }
    }
    return tx.companyInvoiceSettings.findUniqueOrThrow({
      where: { id: updatedSettings.id },
      include: { paymentAccounts: true },
    });
  });

  return NextResponse.json({ settings: serializeSettings(updated) });
}
