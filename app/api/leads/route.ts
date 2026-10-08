import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { leadAccessWhere } from "@/lib/api-auth";
import { priorityForStage, type LeadPriority } from "@/lib/lead-ui";
import { formatMonthlyRevenue, parseYesNo } from "@/lib/lead-custom-fields";
import { ensureStandardCustomFields } from "@/lib/standard-custom-fields";
import { CLOSED_LOST_OUTCOME } from "@/lib/lost-reasons";
import { Prisma } from "../../../generated/prisma/client";

const priorityValues = new Set(["hot", "warm", "cold"]);
const listSortFields = {
  company: "company",
  followUpDate: "followUpDate",
  createdAt: "createdAt",
  stageChangedAt: "stageChangedAt",
} as const;

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

async function getProfile() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  return prisma.user.findFirst({
    where: { id: user.id, isActive: true },
  });
}

const leadListSelect = {
  id: true,
  company: true,
  niche: true,
  contact: true,
  phone: true,
  priority: true,
  followUpDate: true,
  followUpTime: true,
  createdAt: true,
  stageChangedAt: true,
  stage: { select: { name: true } },
  assignee: { select: { name: true } },
  source: { select: { name: true } },
  _count: { select: { activities: { where: { outcome: { not: CLOSED_LOST_OUTCOME } } } } },
  activities: {
    orderBy: { createdAt: "desc" as const },
    take: 1,
    select: { outcome: true, notes: true },
  },
} satisfies Prisma.LeadSelect;

type LeadListRow = Prisma.LeadGetPayload<{ select: typeof leadListSelect }>;

function serializeLead(lead: {
  id: string;
  company: string;
  niche: string | null;
  contact: string | null;
  phone: string | null;
  priority: string | null;
  followUpDate: Date | null;
  followUpTime: Date | null;
  stage: { name: string };
  assignee: { name: string };
  source: { name: string } | null;
  createdAt: Date;
  stageChangedAt: Date | null;
  _count: { activities: number };
  activities: { outcome: string; notes: string | null }[];
}) {
  return {
    id: lead.id,
    company: lead.company,
    niche: lead.niche ?? "",
    contact: lead.contact ?? "",
    phone: lead.phone ?? "",
    priority: lead.priority,
    followUpDate: lead.followUpDate?.toISOString() ?? null,
    followUpTime: lead.followUpTime?.toISOString() ?? null,
    stage: lead.stage.name,
    assigneeName: lead.assignee.name,
    source: lead.source?.name ?? "",
    calls: lead._count.activities,
    lastOutcome: lead.activities[0]?.outcome ?? "",
    lastNotes: lead.activities[0]?.notes ?? "",
    createdAt: lead.createdAt.toISOString(),
    stageChangedAt: lead.stageChangedAt?.toISOString() ?? null,
  };
}

export async function GET(request: Request) {
  const profile = await getProfile();
  if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const searchParams = new URL(request.url).searchParams;
  const query = text(searchParams.get("q"));
  const followUpsOnly = searchParams.get("followups") === "1";
  const page = Math.max(1, Number(searchParams.get("page") ?? "1") || 1);
  const requestedPageSize = Number(searchParams.get("pageSize") ?? "25");
  const pageSize = Math.min(100, Math.max(1, Number.isFinite(requestedPageSize) ? requestedPageSize : 25));
  const paginated = searchParams.has("page") || searchParams.has("pageSize");
  const stage = text(searchParams.get("stage"));
  const assignee = text(searchParams.get("assignee"));
  const niche = text(searchParams.get("niche"));
  const priority = text(searchParams.get("priority"));
  const dateRange = text(searchParams.get("dateRange"));
  const sort = text(searchParams.get("sort")) as keyof typeof listSortFields;
  const direction = searchParams.get("direction") === "desc" ? "desc" : "asc";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dateFilter = dateRange === "Overdue"
    ? { followUpDate: { lt: today } }
    : dateRange === "Today"
      ? { followUpDate: { gte: today, lt: new Date(today.getTime() + 24 * 60 * 60 * 1000) } }
      : dateRange === "Next 7 days"
        ? { followUpDate: { gte: today, lt: new Date(today.getTime() + 8 * 24 * 60 * 60 * 1000) } }
        : {};
  const stageFilter = stage
    ? { name: stage }
    : followUpsOnly
      ? { name: { notIn: ["Closed Won", "Closed Lost", "Dead Lead"] } }
      : undefined;
  const where = {
    ...leadAccessWhere(profile),
    ...(followUpsOnly
      ? { followUpDate: { not: null } }
      : {}),
    ...(stageFilter ? { stage: stageFilter } : {}),
    ...(assignee ? { assignee: { name: assignee } } : {}),
    ...(niche ? { niche } : {}),
    ...(priority && priorityValues.has(priority) ? { priority: priority as "hot" | "warm" | "cold" } : {}),
    ...dateFilter,
    ...(query ? {
      OR: [
        { company: { contains: query, mode: "insensitive" as const } },
        { contact: { contains: query, mode: "insensitive" as const } },
        { phone: { contains: query } },
        { niche: { contains: query, mode: "insensitive" as const } },
      ],
    } : {}),
  };
  const orderBy = sort && listSortFields[sort]
    ? { [listSortFields[sort]]: direction } as const
    : { createdAt: "desc" as const };
  const [leads, total] = await Promise.all([
    prisma.lead.findMany({
      where,
      ...(paginated ? { skip: (page - 1) * pageSize, take: pageSize } : query ? { take: 8 } : {}),
      orderBy,
      select: leadListSelect,
    }),
    paginated ? prisma.lead.count({ where }) : Promise.resolve(0),
  ]);
  return NextResponse.json({
    leads: (leads as LeadListRow[]).map(serializeLead),
    ...(paginated ? { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) } : {}),
  });
}

export async function POST(request: Request) {
  const profile = await getProfile();
  if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json() as {
    company?: string; niche?: string; contact?: string; phone?: string;
    source?: string; priority?: string | null; assigneeName?: string; stage?: string;
    monthlyRevenue?: { currency?: string; amount?: string };
    discoveryCall?: string;
    proposalSent?: boolean;
  };
  const company = text(body.company);
  if (!company) return NextResponse.json({ error: "Company name is required" }, { status: 400 });

  const stage = await prisma.pipelineStage.findFirst({
    where: { name: text(body.stage) || "New Lead", isActive: true },
  });
  const assignee = profile.role === "superadmin" && text(body.assigneeName)
    ? await prisma.user.findFirst({ where: { name: text(body.assigneeName), isActive: true } })
    : profile;
  if (!stage) return NextResponse.json({ error: "Selected stage was not found" }, { status: 400 });
  if (!assignee) return NextResponse.json({ error: "Selected assignee was not found" }, { status: 400 });

  const sourceName = text(body.source);
  const source = sourceName
    ? await prisma.leadSource.upsert({ where: { name: sourceName }, update: {}, create: { name: sourceName } })
    : null;
  const rawPriority = text(body.priority).toLowerCase();
  const priority = priorityValues.has(rawPriority) ? rawPriority as LeadPriority : priorityForStage(stage.name);

  const standardIds = await ensureStandardCustomFields();
  const monthlyRevenue = formatMonthlyRevenue({
    currency: body.monthlyRevenue?.currency === "$" ? "$" : "LKR",
    amount: text(body.monthlyRevenue?.amount),
  });
  const discoveryCall = parseYesNo(body.discoveryCall);
  const customFieldValues = [
    ...(monthlyRevenue ? [{ customFieldId: standardIds.monthlyRevenue, value: monthlyRevenue }] : []),
    ...(discoveryCall ? [{ customFieldId: standardIds.discoveryCall, value: discoveryCall }] : []),
  ];
  const proposalSent = body.proposalSent === true;

  const lead = await prisma.lead.create({
    data: {
      company,
      niche: text(body.niche) || undefined,
      contact: text(body.contact) || undefined,
      phone: text(body.phone) || undefined,
      priority,
      sourceId: source?.id,
      stageId: stage.id,
      assigneeId: assignee.id,
      createdBy: profile.id,
      proposalSent,
      proposalSentDate: proposalSent ? new Date() : undefined,
      customFieldValues: customFieldValues.length > 0 ? { create: customFieldValues } : undefined,
    },
  });
  return NextResponse.json({ id: lead.id }, { status: 201 });
}

export async function PATCH(request: Request) {
  const profile = await getProfile();
  if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json() as { ids?: string[]; stage?: string; assigneeName?: string; lostReason?: string };
  const ids = Array.isArray(body.ids) ? body.ids.filter((id): id is string => typeof id === "string") : [];
  if (ids.length === 0) return NextResponse.json({ error: "At least one lead id is required" }, { status: 400 });

  const data: { stageId?: string; assigneeId?: string; stageChangedAt?: Date; lostReason?: string | null; priority?: LeadPriority } = {};
  if (body.stage) {
    const stage = await prisma.pipelineStage.findFirst({ where: { name: text(body.stage), isActive: true } });
    if (!stage) return NextResponse.json({ error: "Selected stage was not found" }, { status: 400 });
    data.stageId = stage.id;
    data.stageChangedAt = new Date();
    data.priority = priorityForStage(stage.name);
    data.lostReason = body.stage === "Closed Lost" ? text(body.lostReason) || null : null;
  }
  const markingLost = Boolean(data.stageId) && body.stage === "Closed Lost";
  if (body.assigneeName) {
    if (profile.role !== "superadmin") return NextResponse.json({ error: "Only superadmins can reassign leads" }, { status: 403 });
    const assignee = await prisma.user.findFirst({ where: { name: text(body.assigneeName), isActive: true } });
    if (!assignee) return NextResponse.json({ error: "Selected assignee was not found" }, { status: 400 });
    data.assigneeId = assignee.id;
  }
  const activities = await prisma.$transaction(async (tx) => {
    const accessibleLeads = await tx.lead.findMany({
      where: { id: { in: ids }, ...leadAccessWhere(profile) },
      select: { id: true, stageId: true },
    });
    if (accessibleLeads.length !== ids.length) return null;
    const newlyLost = markingLost
      ? accessibleLeads.filter((lead) => lead.stageId !== data.stageId)
      : [];
    await tx.lead.updateMany({ where: { id: { in: ids }, ...leadAccessWhere(profile) }, data });
    return Promise.all(newlyLost.map(({ id }) => tx.activity.create({
      data: { leadId: id, outcome: CLOSED_LOST_OUTCOME, notes: data.lostReason ?? undefined, loggedBy: profile.id },
    })));
  });
  if (!activities) return NextResponse.json({ error: "One or more leads were not found" }, { status: 404 });
  return NextResponse.json({
    updated: ids.length,
    activities: activities.map((activity) => ({
      id: activity.id,
      leadId: activity.leadId,
      outcome: activity.outcome,
      notes: activity.notes ?? "",
      loggedBy: profile.name,
      createdAt: activity.createdAt.toISOString(),
    })),
  });
}

export async function DELETE(request: Request) {
  const profile = await getProfile();
  if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (profile.role !== "superadmin") return NextResponse.json({ error: "Only superadmins can delete leads" }, { status: 403 });

  const body = await request.json() as { ids?: string[] };
  const ids = Array.isArray(body.ids) ? body.ids.filter((id): id is string => typeof id === "string") : [];
  if (ids.length === 0) return NextResponse.json({ error: "At least one lead id is required" }, { status: 400 });
  const result = await prisma.lead.deleteMany({ where: { id: { in: ids }, ...leadAccessWhere(profile) } });
  return NextResponse.json({ deleted: result.count });
}