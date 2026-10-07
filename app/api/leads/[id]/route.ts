import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { leadAccessWhere, requireProfile } from "@/lib/api-auth";
import { formatMonthlyRevenue, parseMonthlyRevenue, parseYesNo } from "@/lib/lead-custom-fields";
import { ensureStandardCustomFields, standardFieldKey } from "@/lib/standard-custom-fields";

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
  const { profile, response } = await requireProfile(request);
  if (response || !profile) return response ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const standardIds = await ensureStandardCustomFields();
  const [lead, fields] = await Promise.all([
    prisma.lead.findFirst({
      where: { id, ...leadAccessWhere(profile) },
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
  const standardOrder = Object.values(standardIds);
  const orderedFields = [...fields].sort((a, b) => {
    const rank = (fieldId: string) => {
      const index = standardOrder.indexOf(fieldId);
      return index === -1 ? standardOrder.length : index;
    };
    return rank(a.id) - rank(b.id);
  });

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
      customFields: orderedFields.map((field) => {
        const stored = values.get(field.id) ?? "";
        const type = fieldTypes[field.type];
        return {
          id: field.id,
          key: standardFieldKey(standardIds, field.id),
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

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
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
  const { profile, response } = await requireProfile(request);
  if (response) return response;

  const { id } = await params;
  const body = await request.json().catch(() => null) as {
    followUpDate?: string | null;
    followUpTime?: string | null;
    company?: string;
    niche?: string;
    contact?: string;
    phone?: string;
    source?: string;
    assigneeName?: string;
    proposalSent?: boolean;
    notes?: string | null;
    customFields?: Array<{ id?: string; value?: string | boolean }>;
  } | null;
  if (!body) return NextResponse.json({ error: "Invalid request body" }, { status: 400 });

  const data: {
    followUpDate?: Date | null;
    followUpTime?: Date | null;
    company?: string;
    niche?: string | null;
    contact?: string | null;
    phone?: string | null;
    sourceId?: string | null;
    assigneeId?: string;
    proposalSent?: boolean;
    proposalSentDate?: Date | null;
    notes?: string | null;
  } = {};

  if (body.company !== undefined) {
    const company = text(body.company);
    if (!company) return NextResponse.json({ error: "Company name is required" }, { status: 400 });
    data.company = company;
  }
  if (body.niche !== undefined) data.niche = text(body.niche) || null;
  if (body.contact !== undefined) data.contact = text(body.contact) || null;
  if (body.phone !== undefined) data.phone = text(body.phone) || null;
  if (body.source !== undefined) {
    const sourceName = text(body.source);
    data.sourceId = sourceName
      ? (await prisma.leadSource.upsert({ where: { name: sourceName }, update: {}, create: { name: sourceName } })).id
      : null;
  }
  if (body.assigneeName !== undefined) {
    if (profile.role !== "superadmin") return NextResponse.json({ error: "Only superadmins can reassign leads" }, { status: 403 });
    const assignee = await prisma.user.findFirst({ where: { name: text(body.assigneeName), isActive: true } });
    if (!assignee) return NextResponse.json({ error: "Selected assignee was not found" }, { status: 400 });
    data.assigneeId = assignee.id;
  }
  if (typeof body.proposalSent === "boolean") {
    data.proposalSent = body.proposalSent;
    data.proposalSentDate = body.proposalSent ? new Date() : null;
  }
  if (body.notes !== undefined) {
    if (body.notes !== null && typeof body.notes !== "string") return NextResponse.json({ error: "Notes must be text" }, { status: 400 });
    data.notes = body.notes?.trim() ? body.notes : null;
  }

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

  const customInputs = Array.isArray(body.customFields)
    ? body.customFields.filter((entry): entry is { id: string; value?: string | boolean } => typeof entry?.id === "string")
    : [];
  if (Object.keys(data).length === 0 && customInputs.length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const existing = await prisma.lead.findFirst({ where: { id, ...leadAccessWhere(profile) }, select: { id: true } });
  if (!existing) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

  const standardIds = await ensureStandardCustomFields();
  const fields = customInputs.length > 0
    ? await prisma.customField.findMany({ where: { id: { in: customInputs.map((entry) => entry.id) } } })
    : [];
  const fieldsById = new Map(fields.map((field) => [field.id, field]));
  const customValues: Array<{ customFieldId: string; value: string }> = [];
  for (const entry of customInputs) {
    const field = fieldsById.get(entry.id);
    if (!field) return NextResponse.json({ error: "Custom field not found" }, { status: 400 });
    const key = standardFieldKey(standardIds, field.id);
    const raw = typeof entry.value === "boolean" ? String(entry.value) : text(entry.value);
    const value = key === "monthlyRevenue"
      ? formatMonthlyRevenue(parseMonthlyRevenue(raw))
      : key === "discoveryCall"
        ? parseYesNo(raw)
        : field.type === "TOGGLE"
          ? String(raw === "true")
          : raw;
    customValues.push({ customFieldId: field.id, value });
  }

  const lead = await prisma.$transaction(async (tx) => {
    for (const { customFieldId, value } of customValues) {
      await tx.leadCustomFieldValue.upsert({
        where: { leadId_customFieldId: { leadId: id, customFieldId } },
        update: { value },
        create: { leadId: id, customFieldId, value },
      });
    }
    return tx.lead.update({
      where: { id },
      data,
      select: { proposalSentDate: true },
    });
  });

  return NextResponse.json({
    id,
    proposalSentDate: lead.proposalSentDate?.toISOString() ?? null,
    customFields: customValues.map(({ customFieldId, value }) => ({ id: customFieldId, value })),
  });
}
