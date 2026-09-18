import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

type ImportRow = Record<string, string>;
type Mapping = { sourceHeader: string; targetField: string };

const priorityValues = new Set(["hot", "warm", "cold"]);

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function dateValue(value: string) {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const profile = await prisma.user.findFirst({
    where: { OR: [{ id: user.id }, { email: user.email ?? "" }], isActive: true },
  });
  if (!profile) return NextResponse.json({ error: "Active CRM user not found" }, { status: 403 });
  if (profile.role !== "superadmin") return NextResponse.json({ error: "Only superadmins can import leads" }, { status: 403 });

  const body = await request.json() as {
    rows?: ImportRow[];
    mappings?: Mapping[];
    duplicateAction?: "skip" | "import";
    assigneeName?: string;
  };
  if (!Array.isArray(body.rows) || body.rows.length === 0 || !Array.isArray(body.mappings)) {
    return NextResponse.json({ error: "Rows and mappings are required" }, { status: 400 });
  }

  const mappings = new Map(
    body.mappings
      .filter((mapping) => mapping.targetField !== "— Ignore field —")
      .map((mapping) => [mapping.targetField, mapping.sourceHeader]),
  );
  const assigneeName = text(body.assigneeName);
  const users = await prisma.user.findMany({ where: { isActive: true } });
  const usersByName = new Map(users.map((user) => [user.name.toLowerCase(), user]));
  const assignee = assigneeName ? usersByName.get(assigneeName.toLowerCase()) : profile;
  if (!assignee) return NextResponse.json({ error: "Selected assignee was not found" }, { status: 400 });

  const stages = await prisma.pipelineStage.findMany({ where: { isActive: true }, orderBy: { position: "asc" } });
  const stagesByName = new Map(stages.map((stage) => [stage.name.toLowerCase(), stage]));
  const defaultStage = stages.find((stage) => stage.isDefault) ?? stages[0];
  if (!defaultStage) return NextResponse.json({ error: "No active pipeline stage is configured" }, { status: 400 });

  const assigneeHeader = mappings.get("Assignee");
  const stageHeader = mappings.get("Stage");
  const companyHeader = mappings.get("Company");
  const phoneHeader = mappings.get("Phone");
  const sourceHeader = mappings.get("Source");
  const sourceNames = [...new Set(body.rows.map((row) => text(sourceHeader ? row[sourceHeader] : "" )).filter(Boolean))];
  const sources = await prisma.leadSource.findMany({ where: { name: { in: sourceNames } } });
  const sourcesByName = new Map(sources.map((source) => [source.name.toLowerCase(), source]));
  for (const sourceName of sourceNames) {
    if (!sourcesByName.has(sourceName.toLowerCase())) {
      const source = await prisma.leadSource.create({ data: { name: sourceName } });
      sourcesByName.set(source.name.toLowerCase(), source);
    }
  }

  const phones = [...new Set(body.rows.map((row) => text(phoneHeader ? row[phoneHeader] : "")).filter(Boolean))];
  const existingLeads = phones.length > 0
    ? await prisma.lead.findMany({ where: { phone: { in: phones } }, select: { company: true, phone: true } })
    : [];
  const existingKeys = new Set(existingLeads.map((lead) => `${lead.company.toLowerCase()}|${lead.phone ?? ""}`));

  const failedRows: Array<{ row: number; error: string }> = [];
  let skipped = 0;
  const leadData: Array<{
    company: string;
    contact?: string;
    phone?: string;
    niche?: string;
    notes?: string;
    priority?: "hot" | "warm" | "cold";
    followUpDate?: Date;
    sourceId?: string;
    stageId: string;
    assigneeId: string;
    createdBy: string;
  }> = [];

  for (const [index, row] of body.rows.entries()) {
    const company = text(companyHeader ? row[companyHeader] : "");
    const phone = text(phoneHeader ? row[phoneHeader] : "");
    if (!company) {
      failedRows.push({ row: index + 2, error: "Company is required" });
      continue;
    }

    const rowAssigneeName = text(assigneeHeader ? row[assigneeHeader] : "") || assignee.name;
    const rowAssignee = usersByName.get(rowAssigneeName.toLowerCase());
    if (!rowAssignee) {
      failedRows.push({ row: index + 2, error: `Assignee not found: ${rowAssigneeName}` });
      continue;
    }

    const rowStageName = text(stageHeader ? row[stageHeader] : "");
    const rowStage = rowStageName ? stagesByName.get(rowStageName.toLowerCase()) : defaultStage;
    if (!rowStage) {
      failedRows.push({ row: index + 2, error: `Stage not found: ${rowStageName}` });
      continue;
    }

    const duplicateKey = `${company.toLowerCase()}|${phone}`;
    if (phone && existingKeys.has(duplicateKey) && body.duplicateAction !== "import") {
      skipped += 1;
      continue;
    }

    const sourceName = text(sourceHeader ? row[sourceHeader] : "");
    const rawPriority = text(row[mappings.get("Priority") ?? ""]).toLowerCase();
    const priority = priorityValues.has(rawPriority) ? rawPriority as "hot" | "warm" | "cold" : undefined;
    const followUpDate = dateValue(text(row[mappings.get("Follow-up Date") ?? ""]));
    leadData.push({
      company,
      contact: text(row[mappings.get("Contact Name") ?? ""]) || undefined,
      phone: phone || undefined,
      niche: text(row[mappings.get("Niche") ?? ""]) || undefined,
      notes: text(row[mappings.get("Notes") ?? ""]) || undefined,
      priority,
      followUpDate,
      sourceId: sourceName ? sourcesByName.get(sourceName.toLowerCase())?.id : undefined,
      stageId: rowStage.id,
      assigneeId: rowAssignee.id,
      createdBy: profile.id,
    });
  }

  if (leadData.length > 0) {
    await prisma.$transaction((transaction) => transaction.lead.createMany({ data: leadData }));
  }

  return NextResponse.json({ imported: leadData.length, skipped, failedRows });
}