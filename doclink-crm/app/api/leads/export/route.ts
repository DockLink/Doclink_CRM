import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireProfile, checkRateLimit, requireRole } from "@/lib/api-auth"; // adjust path to match your actual auth helper location
import * as XLSX from "xlsx"; // run `npm install xlsx` if this isn't already a dependency
import type { Prisma } from "../../../../../generated/prisma/client"; // adjust relative depth if this file moves

function buildWhere(searchParams: URLSearchParams): Prisma.LeadWhereInput {
  const where: Prisma.LeadWhereInput = {};

  const from = searchParams.get("from");
  const to = searchParams.get("to");
  if (from || to) {
    where.createdAt = {
      ...(from ? { gte: new Date(from) } : {}),
      ...(to ? { lte: new Date(`${to}T23:59:59`) } : {}),
    };
  }

  const stageId = searchParams.get("stageId");
  if (stageId) where.stageId = stageId;

  const assigneeId = searchParams.get("assigneeId");
  if (assigneeId) where.assigneeId = assigneeId;

  const niche = searchParams.get("niche");
  if (niche) where.niche = niche;

  const priorityParam = searchParams.get("priority"); // comma-separated: hot,warm,cold
  if (priorityParam) {
    const values = priorityParam.split(",").filter(Boolean) as ("hot" | "warm" | "cold")[];
    if (values.length > 0) where.priority = { in: values };
  }

  return where;
}

export async function GET(request: Request) {
  const limited = checkRateLimit(request, "leads-export");
  if (limited) return limited;

  const { profile, response } = await requireProfile(request);
  if (response) return response;

  const forbidden = requireRole(profile, "superadmin");
  if (forbidden) return forbidden;

  const { searchParams } = new URL(request.url);

  // ─── Filter metadata for the dropdowns ────────────────────────────────
  if (searchParams.get("meta") === "1") {
    const [stages, assignees, nicheRows] = await Promise.all([
      prisma.pipelineStage.findMany({
        where: { isActive: true },
        orderBy: { position: "asc" },
        select: { id: true, name: true },
      }),
      prisma.user.findMany({
        where: { isActive: true },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      }),
      prisma.lead.findMany({
        where: { niche: { not: null } },
        distinct: ["niche"],
        select: { niche: true },
      }),
    ]);
    return NextResponse.json({
      stages,
      assignees,
      niches: nicheRows.map((r) => r.niche).filter((n): n is string => Boolean(n)),
    });
  }

  const where = buildWhere(searchParams);

  // ─── Live count preview (no file generated) ───────────────────────────
  if (searchParams.get("count") === "1") {
    const count = await prisma.lead.count({ where });
    return NextResponse.json({ count });
  }

  // ─── Actual export ─────────────────────────────────────────────────────
  const format = searchParams.get("format") === "csv" ? "csv" : "xlsx";

  const leads = await prisma.lead.findMany({
    where,
    include: {
      stage: true,
      assignee: true,
      source: true,
      customFieldValues: { include: { customField: true } },
      _count: { select: { activities: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const customFieldLabels = Array.from(
    new Set(leads.flatMap((l) => l.customFieldValues.map((v) => v.customField.label)))
  );

  const rows = leads.map((lead) => {
    const row: Record<string, string | number> = {
      Company: lead.company,
      Niche: lead.niche ?? "",
      Contact: lead.contact ?? "",
      Phone: lead.phone ?? "",
      Stage: lead.stage.name,
      Assignee: lead.assignee.name,
      Source: lead.source?.name ?? "",
      Priority: lead.priority ?? "",
      "Follow-up Date": lead.followUpDate ? lead.followUpDate.toISOString().slice(0, 10) : "",
      "Proposal Sent": lead.proposalSent ? "Yes" : "No",
      "Lost Reason": lead.lostReason ?? "",
      "Calls Logged": lead._count.activities,
      "Created At": lead.createdAt.toISOString().slice(0, 10),
    };
    for (const label of customFieldLabels) {
      const match = lead.customFieldValues.find((v) => v.customField.label === label);
      row[label] = match?.value ?? "";
    }
    return row;
  });

  const header = [
    "Company",
    "Niche",
    "Contact",
    "Phone",
    "Stage",
    "Assignee",
    "Source",
    "Priority",
    "Follow-up Date",
    "Proposal Sent",
    "Lost Reason",
    "Calls Logged",
    "Created At",
    ...customFieldLabels,
  ];

  const filename = `leads-export-${new Date().toISOString().slice(0, 10)}.${format}`;
  const worksheet = XLSX.utils.json_to_sheet(rows, { header });

  if (format === "csv") {
    // BOM so Excel detects UTF-8 when opening the CSV directly
    const csv = "\uFEFF" + XLSX.utils.sheet_to_csv(worksheet);
    const body = new TextEncoder().encode(csv);
    return new NextResponse(body, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(body.byteLength),
        "Cache-Control": "no-store",
      },
    });
  }

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Leads");
  const xlsxBuffer = XLSX.write(workbook, { type: "array", bookType: "xlsx" }) as ArrayBuffer;

  return new NextResponse(xlsxBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(xlsxBuffer.byteLength),
      "Cache-Control": "no-store",
    },
  });
}