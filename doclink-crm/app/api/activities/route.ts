import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, requireProfile } from "@/lib/api-auth";

export async function GET(request: Request) {
  const limited = checkRateLimit(request, "activities");
  if (limited) return limited;
  const { profile, response } = await requireProfile(request);
  if (response) return response;

  const leadId = new URL(request.url).searchParams.get("leadId");
  const activities = await prisma.activity.findMany({
    where: leadId ? { leadId } : undefined,
    orderBy: { createdAt: "desc" },
    include: { logger: { select: { name: true } } },
  });
  return NextResponse.json({ activities: activities.map((activity) => ({
    id: activity.id,
    leadId: activity.leadId,
    outcome: activity.outcome,
    notes: activity.notes ?? "",
    loggedBy: activity.logger.name,
    createdAt: activity.createdAt.toISOString(),
  })) });
}

export async function POST(request: Request) {
  const limited = checkRateLimit(request, "activities", 60);
  if (limited) return limited;
  const { profile, response } = await requireProfile(request);
  if (response) return response;

  const body = await request.json() as {
    leadId?: string;
    outcome?: string;
    notes?: string;
    followUpDate?: string;
    followUpTime?: string;
  };
  const leadId = body.leadId?.trim() ?? "";
  const outcome = body.outcome?.trim() ?? "";
  if (!leadId || !outcome) return NextResponse.json({ error: "Lead and outcome are required" }, { status: 400 });

  const followUpDate = body.followUpDate?.trim() ? dateOnly(body.followUpDate.trim()) : undefined;
  const followUpTime = body.followUpTime?.trim() ? timeOnly(body.followUpTime.trim()) : undefined;
  if (body.followUpDate?.trim() && !followUpDate) return NextResponse.json({ error: "Follow-up date must be YYYY-MM-DD" }, { status: 400 });
  if (body.followUpTime?.trim() && !followUpTime) return NextResponse.json({ error: "Follow-up time must be HH:MM" }, { status: 400 });

  const saved = await prisma.$transaction(async (transaction) => {
    const lead = await transaction.lead.findUnique({ where: { id: leadId }, select: { id: true } });
    if (!lead) return null;
    const created = await transaction.activity.create({
      data: { leadId, outcome, notes: body.notes?.trim() || undefined, loggedBy: profile.id },
    });
    await transaction.lead.update({
      where: { id: leadId },
      data: {
        lastActivityAt: new Date(),
        ...(followUpDate ? { followUpDate } : {}),
        ...(followUpTime ? { followUpTime } : {}),
      },
    });
    const calls = await transaction.activity.count({ where: { leadId } });
    return { created, calls };
  });
  if (!saved) return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  return NextResponse.json({
    id: saved.created.id,
    outcome,
    notes: body.notes?.trim() ?? "",
    loggedBy: profile.name,
    createdAt: saved.created.createdAt.toISOString(),
    calls: saved.calls,
  }, { status: 201 });
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