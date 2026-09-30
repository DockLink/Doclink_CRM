import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { priorityForStage, type LeadPriority } from "@/lib/lead-ui";
import { formatMonthlyRevenue, parseYesNo } from "@/lib/lead-custom-fields";
import { ensureStandardCustomFields } from "@/lib/standard-custom-fields";

const priorityValues = new Set(["hot", "warm", "cold"]);

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

async function getProfile() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  return prisma.user.findFirst({
    where: { OR: [{ id: user.id }, { email: user.email ?? "" }], isActive: true },
  });
}

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

export async function GET() {
  const profile = await getProfile();
  if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const leads = await prisma.lead.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      stage: { select: { name: true } },
      assignee: { select: { name: true } },
      source: { select: { name: true } },
      _count: { select: { activities: true } },
      activities: { orderBy: { createdAt: "desc" }, take: 1, select: { outcome: true, notes: true } },
    },
  });
  return NextResponse.json({ leads: leads.map(serializeLead) });
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
  const assignee = text(body.assigneeName)
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
    currency: body.monthlyRevenue?.currency === "$" ? "$" : "Rs",
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
  if (body.assigneeName) {
    if (profile.role !== "superadmin") return NextResponse.json({ error: "Only superadmins can reassign leads" }, { status: 403 });
    const assignee = await prisma.user.findFirst({ where: { name: text(body.assigneeName), isActive: true } });
    if (!assignee) return NextResponse.json({ error: "Selected assignee was not found" }, { status: 400 });
    data.assigneeId = assignee.id;
  }
  await prisma.lead.updateMany({ where: { id: { in: ids } }, data });
  return NextResponse.json({ updated: ids.length });
}

export async function DELETE(request: Request) {
  const profile = await getProfile();
  if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (profile.role !== "superadmin") return NextResponse.json({ error: "Only superadmins can delete leads" }, { status: 403 });

  const body = await request.json() as { ids?: string[] };
  const ids = Array.isArray(body.ids) ? body.ids.filter((id): id is string => typeof id === "string") : [];
  if (ids.length === 0) return NextResponse.json({ error: "At least one lead id is required" }, { status: 400 });
  const result = await prisma.lead.deleteMany({ where: { id: { in: ids } } });
  return NextResponse.json({ deleted: result.count });
}