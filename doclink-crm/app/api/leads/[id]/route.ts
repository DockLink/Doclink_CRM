import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireProfile } from "@/lib/api-auth";

const fieldTypes = {
  TEXT: "text",
  NUMBER: "number",
  DATE: "date",
  DROPDOWN: "dropdown",
  TOGGLE: "toggle",
  URL: "link",
} as const;

function dateInput(value: Date | null) {
  if (!value) return "";
  const year = value.getUTCFullYear();
  const month = String(value.getUTCMonth() + 1).padStart(2, "0");
  const day = String(value.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function timeInput(value: Date | null) {
  if (!value) return "";
  const hours = String(value.getUTCHours()).padStart(2, "0");
  const minutes = String(value.getUTCMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

function dropdownOptions(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.filter((option): option is string => typeof option === "string");
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { response } = await requireProfile(request);
  if (response) return response;

  const { id } = await params;
  const [lead, fields] = await Promise.all([
    prisma.lead.findUnique({
      where: { id },
      include: {
        stage: { select: { name: true } },
        assignee: { select: { name: true } },
        source: { select: { name: true } },
        activities: {
          orderBy: { createdAt: "desc" },
          include: { logger: { select: { name: true } } },
        },
        customFieldValues: true,
      },
    }),
    prisma.customField.findMany({
      where: { isActive: true },
      orderBy: { label: "asc" },
    }),
  ]);

  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

  const values = new Map(lead.customFieldValues.map((entry) => [entry.customFieldId, entry.value ?? ""]));

  return NextResponse.json({
    lead: {
      id: lead.id,
      company: lead.company,
      niche: lead.niche ?? "",
      contact: lead.contact ?? "",
      phone: lead.phone ?? "",
      source: lead.source?.name ?? "",
      priority: lead.priority ?? "cold",
      stage: lead.stage.name,
      assigneeName: lead.assignee.name,
      proposalSent: lead.proposalSent,
      proposalSentDate: lead.proposalSentDate?.toISOString() ?? null,
      followUpDate: dateInput(lead.followUpDate),
      followUpTime: timeInput(lead.followUpTime),
      notes: lead.notes ?? "",
      lostReason: lead.lostReason,
      customFields: fields.map((field) => {
        const stored = values.get(field.id) ?? "";
        const type = fieldTypes[field.type];
        return {
          id: field.id,
          label: field.label,
          type,
          value: type === "toggle" ? stored.toLowerCase() === "true" : stored,
          ...(type === "dropdown" ? { options: dropdownOptions(field.options) } : {}),
        };
      }),
      activities: lead.activities.map((activity) => ({
        id: activity.id,
        outcome: activity.outcome,
        notes: activity.notes ?? "",
        loggedBy: activity.logger.name,
        createdAt: activity.createdAt.toISOString(),
      })),
    },
  });
}

function dateOnly(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
}

function timeOnly(value: string) {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  return new Date(Date.UTC(1970, 0, 1, Number(match[1]), Number(match[2])));
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { response } = await requireProfile(request);
  if (response) return response;

  const { id } = await params;
  const body = await request.json() as { followUpDate?: string | null; followUpTime?: string | null };
  const data: { followUpDate?: Date | null; followUpTime?: Date | null } = {};

  if ("followUpDate" in body) {
    if (!body.followUpDate) {
      data.followUpDate = null;
    } else {
      const parsed = dateOnly(body.followUpDate);
      if (!parsed) return NextResponse.json({ error: "Follow-up date must be YYYY-MM-DD" }, { status: 400 });
      data.followUpDate = parsed;
    }
  }
  if ("followUpTime" in body) {
    if (!body.followUpTime) {
      data.followUpTime = null;
    } else {
      const parsed = timeOnly(body.followUpTime);
      if (!parsed) return NextResponse.json({ error: "Follow-up time must be HH:MM" }, { status: 400 });
      data.followUpTime = parsed;
    }
  }
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const existing = await prisma.lead.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  await prisma.lead.update({ where: { id }, data });
  return NextResponse.json({ id });
}
