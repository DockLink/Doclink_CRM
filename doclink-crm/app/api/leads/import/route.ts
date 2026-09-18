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
  const assignee = assigneeName
    ? await prisma.user.findFirst({ where: { name: assigneeName, isActive: true } })
    : profile;
  if (!assignee) return NextResponse.json({ error: "Selected assignee was not found" }, { status: 400 });

  const defaultStage = await prisma.pipelineStage.findFirst({
    where: { isActive: true, isDefault: true },
    orderBy: { position: "asc" },
  }) ?? await prisma.pipelineStage.findFirst({ where: { isActive: true }, orderBy: { position: "asc" } });
  if (!defaultStage) return NextResponse.json({ error: "No active pipeline stage is configured" }, { status: 400 });

  const assigneeHeader = mappings.get("Assignee");
  const stageHeader = mappings.get("Stage");

  const failedRows: Array<{ row: number; error: string }> = [];
  let imported = 0;
  let skipped = 0;

  await prisma.$transaction(async (transaction) => {
    for (const [index, row] of body.rows!.entries()) {
      const company = text(row[mappings.get("Company") ?? ""]);
      const phone = text(row[mappings.get("Phone") ?? ""]);
      if (!company) {
        failedRows.push({ row: index + 2, error: "Company is required" });
        continue;
      }

      const rowAssigneeName = text(assigneeHeader ? row[assigneeHeader] : "") || assignee?.name;
      const rowAssignee = rowAssigneeName === assignee?.name
        ? assignee
        : await transaction.user.findFirst({ where: { name: rowAssigneeName, isActive: true } });
      if (!rowAssignee) {
        failedRows.push({ row: index + 2, error: `Assignee not found: ${rowAssigneeName}` });
        continue;
      }

      const rowStageName = text(stageHeader ? row[stageHeader] : "");
      const rowStage = rowStageName
        ? await transaction.pipelineStage.findFirst({ where: { name: rowStageName, isActive: true } })
        : defaultStage;
      if (!rowStage) {
        failedRows.push({ row: index + 2, error: `Stage not found: ${rowStageName}` });
        continue;
      }

      const duplicate = phone
        ? await transaction.lead.findFirst({ where: { company, phone }, select: { id: true } })
        : null;
      if (duplicate && body.duplicateAction !== "import") {
        skipped += 1;
        continue;
      }

      const sourceName = text(row[mappings.get("Source") ?? ""]);
      const source = sourceName
        ? await transaction.leadSource.upsert({ where: { name: sourceName }, update: {}, create: { name: sourceName } })
        : null;
      const rawPriority = text(row[mappings.get("Priority") ?? ""]).toLowerCase();
      const priority = priorityValues.has(rawPriority) ? rawPriority as "hot" | "warm" | "cold" : undefined;
      const followUpDate = dateValue(text(row[mappings.get("Follow-up Date") ?? ""]));

      await transaction.lead.create({
        data: {
          company,
          contact: text(row[mappings.get("Contact Name") ?? ""]) || undefined,
          phone: phone || undefined,
          niche: text(row[mappings.get("Niche") ?? ""]) || undefined,
          notes: text(row[mappings.get("Notes") ?? ""]) || undefined,
          priority,
          followUpDate,
          sourceId: source?.id,
          stageId: rowStage.id,
          assigneeId: rowAssignee.id,
          createdBy: profile.id,
        },
      });
      imported += 1;
    }
  });

  return NextResponse.json({ imported, skipped, failedRows });
}