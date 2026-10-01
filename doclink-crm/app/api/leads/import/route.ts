import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireProfile } from "@/lib/api-auth";
import { priorityForStage } from "@/lib/lead-ui";
import { formatMonthlyRevenue, parseMonthlyRevenue, parseYesNo } from "@/lib/lead-custom-fields";
import { ensureStandardCustomFields } from "@/lib/standard-custom-fields";

type ImportRow = Record<string, unknown>;
type Mapping = { sourceHeader: string; targetField: string };
type PriorityValue = "hot" | "warm" | "cold";

const IGNORE_FIELD = "— Ignore field —";

const priorityAliases: Record<string, PriorityValue> = {
  hot: "hot", high: "hot", h: "hot", urgent: "hot", "1": "hot",
  warm: "warm", medium: "warm", med: "warm", m: "warm", normal: "warm", "2": "warm",
  cold: "cold", low: "cold", l: "cold", "3": "cold",
};

function text(value: unknown) {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

function utcDate(year: number, month: number, day: number) {
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? date : undefined;
}

function dateValue(value: string) {
  if (!value) return undefined;

  const iso = value.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (iso) return utcDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));

  // Numeric dates are read as day/month/year unless the middle part can only be a day.
  const numeric = value.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})$/);
  if (numeric) {
    const first = Number(numeric[1]);
    const second = Number(numeric[2]);
    const year = numeric[3].length === 2 ? 2000 + Number(numeric[3]) : Number(numeric[3]);
    return second > 12 ? utcDate(year, first, second) : utcDate(year, second, first);
  }

  // Excel serial day numbers (days since 1899-12-30).
  if (/^\d{5}$/.test(value)) {
    const date = new Date(Date.UTC(1899, 11, 30) + Number(value) * 86_400_000);
    return Number.isNaN(date.getTime()) ? undefined : date;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return utcDate(parsed.getFullYear(), parsed.getMonth() + 1, parsed.getDate());
}

export async function POST(request: Request) {
  try {
    const { profile, response } = await requireProfile(request);
    if (response) return response;
    if (profile.role !== "superadmin") return NextResponse.json({ error: "Only superadmins can import leads" }, { status: 403 });

    const body = await request.json().catch(() => null) as {
      rows?: ImportRow[];
      mappings?: Mapping[];
      duplicateAction?: "skip" | "import";
      assigneeName?: string;
      revenueCurrency?: string;
    } | null;
    if (!body || !Array.isArray(body.rows) || body.rows.length === 0 || !Array.isArray(body.mappings)) {
      return NextResponse.json({ error: "Rows and mappings are required" }, { status: 400 });
    }
    const rows = body.rows.filter((row): row is ImportRow => Boolean(row) && typeof row === "object");

    const mappings = new Map<string, string>();
    for (const mapping of body.mappings) {
      if (mapping?.targetField && mapping.targetField !== IGNORE_FIELD && !mappings.has(mapping.targetField)) {
        mappings.set(mapping.targetField, mapping.sourceHeader);
      }
    }
    const cell = (row: ImportRow, field: string) => {
      const header = mappings.get(field);
      return header ? text(row[header]) : "";
    };

    if (!mappings.has("Company")) {
      return NextResponse.json({ error: "Map one of your columns to the Company field before importing" }, { status: 400 });
    }

    const assigneeName = text(body.assigneeName);
    const users = await prisma.user.findMany({ where: { isActive: true } });
    const usersByName = new Map(users.map((entry) => [entry.name.trim().toLowerCase(), entry]));
    const usersByEmail = new Map(users.map((entry) => [entry.email.trim().toLowerCase(), entry]));
    const defaultAssignee = assigneeName ? usersByName.get(assigneeName.toLowerCase()) : profile;
    if (!defaultAssignee) return NextResponse.json({ error: "Selected assignee was not found" }, { status: 400 });

    const stages = await prisma.pipelineStage.findMany({ where: { isActive: true }, orderBy: { position: "asc" } });
    const stagesByName = new Map(stages.map((stage) => [stage.name.trim().toLowerCase(), stage]));
    const defaultStage = stages.find((stage) => stage.isDefault) ?? stages[0];
    if (!defaultStage) return NextResponse.json({ error: "No active pipeline stage is configured" }, { status: 400 });

    const sourceNames = [...new Set(rows.map((row) => cell(row, "Source")).filter(Boolean))];
    const sourcesByName = new Map<string, { id: string; name: string }>();
    if (sourceNames.length > 0) {
      const sources = await prisma.leadSource.findMany();
      for (const source of sources) sourcesByName.set(source.name.trim().toLowerCase(), source);
      for (const sourceName of sourceNames) {
        if (sourcesByName.has(sourceName.toLowerCase())) continue;
        const source = await prisma.leadSource.upsert({ where: { name: sourceName }, update: {}, create: { name: sourceName } });
        sourcesByName.set(sourceName.toLowerCase(), source);
      }
    }

    const phones = [...new Set(rows.map((row) => cell(row, "Phone")).filter(Boolean))];
    const existingLeads = phones.length > 0
      ? await prisma.lead.findMany({ where: { phone: { in: phones } }, select: { company: true, phone: true } })
      : [];
    const existingKeys = new Set(existingLeads.map((lead) => `${lead.company.trim().toLowerCase()}|${lead.phone ?? ""}`));

    const standardIds = await ensureStandardCustomFields();
    const revenueCurrency = body.revenueCurrency === "$" ? "$" : "Rs";

    const failedRows: Array<{ row: number; error: string }> = [];
    let skipped = 0;
    const customFieldData: Array<{ leadId: string; customFieldId: string; value: string }> = [];
    const leadData: Array<{
      id: string;
      company: string;
      contact?: string;
      phone?: string;
      niche?: string;
      notes?: string;
      priority?: PriorityValue;
      followUpDate?: Date;
      sourceId?: string;
      stageId: string;
      assigneeId: string;
      createdBy: string;
      proposalSent: boolean;
      proposalSentDate?: Date;
    }> = [];

    for (const [index, row] of rows.entries()) {
      const company = cell(row, "Company");
      const phone = cell(row, "Phone");
      if (!company) {
        failedRows.push({ row: index + 2, error: "Company is empty" });
        continue;
      }

      const duplicateKey = `${company.toLowerCase()}|${phone}`;
      if (phone && existingKeys.has(duplicateKey) && body.duplicateAction !== "import") {
        skipped += 1;
        continue;
      }
      if (phone) existingKeys.add(duplicateKey);

      const rowAssigneeName = cell(row, "Assignee").toLowerCase();
      const rowAssignee = (rowAssigneeName && (usersByName.get(rowAssigneeName) ?? usersByEmail.get(rowAssigneeName))) || defaultAssignee;
      const rowStageName = cell(row, "Stage").toLowerCase();
      const rowStage = (rowStageName && stagesByName.get(rowStageName)) || defaultStage;
      const sourceName = cell(row, "Source");
      const leadId = crypto.randomUUID();
      const proposalSent = parseYesNo(cell(row, "Proposal Sent")) === "Yes";
      const monthlyRevenue = formatMonthlyRevenue(parseMonthlyRevenue(cell(row, "Monthly Revenue"), revenueCurrency));
      const discoveryCall = parseYesNo(cell(row, "Discovery Call"));
      if (monthlyRevenue) customFieldData.push({ leadId, customFieldId: standardIds.monthlyRevenue, value: monthlyRevenue });
      if (discoveryCall) customFieldData.push({ leadId, customFieldId: standardIds.discoveryCall, value: discoveryCall });

      leadData.push({
        id: leadId,
        company,
        contact: cell(row, "Contact Name") || undefined,
        phone: phone || undefined,
        niche: cell(row, "Niche") || undefined,
        notes: cell(row, "Notes") || undefined,
        priority: priorityAliases[cell(row, "Priority").toLowerCase()] ?? priorityForStage(rowStage.name),
        followUpDate: dateValue(cell(row, "Follow-up Date")),
        sourceId: sourceName ? sourcesByName.get(sourceName.toLowerCase())?.id : undefined,
        stageId: rowStage.id,
        assigneeId: rowAssignee.id,
        createdBy: profile.id,
        proposalSent,
        proposalSentDate: proposalSent ? new Date() : undefined,
      });
    }

    if (leadData.length > 0) {
      await prisma.$transaction([
        prisma.lead.createMany({ data: leadData }),
        ...(customFieldData.length > 0 ? [prisma.leadCustomFieldValue.createMany({ data: customFieldData })] : []),
      ]);
    }

    return NextResponse.json({ imported: leadData.length, skipped, failedRows });
  } catch (error) {
    // Prisma error messages can echo the submitted rows, so only the error kind is logged or returned.
    const code = typeof error === "object" && error !== null && "code" in error ? String(error.code) : undefined;
    console.error("Lead import failed", error instanceof Error ? error.name : typeof error, code ?? "");
    return NextResponse.json({ error: "Import failed due to a server error" }, { status: 500 });
  }
}
