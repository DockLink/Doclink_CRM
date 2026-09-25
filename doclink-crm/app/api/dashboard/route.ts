import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireProfile, checkRateLimit } from "@/lib/api-auth"; // adjust import path to wherever requireProfile/checkRateLimit actually live
import type { Prisma } from "../../../../generated/prisma/client"; // adjust relative depth if this file moves

// ─── Stage name constants ──────────────────────────────────────────────────
// These are plain rows in PipelineStage, not an enum, so matching is by name.
// If you rename these stages in the DB, update the strings here too.
const CLOSED_WON = "Closed Won";
const CLOSED_LOST = "Closed Lost";
const DEAD_LEAD = "Dead Lead";
const CLOSED_STAGE_NAMES = [CLOSED_WON, CLOSED_LOST, DEAD_LEAD];

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfDay(d: Date) {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function daysBetween(a: Date, b: Date) {
  return Math.abs(a.getTime() - b.getTime()) / DAY_MS;
}

export async function GET(request: Request) {
  const limited = checkRateLimit(request, "dashboard");
  if (limited) return limited;

  const { profile, response } = await requireProfile(request);
  if (response) return response;

  const isSuperadmin = profile.role === "superadmin";

  // ─── Scope: admins see only their own assigned leads ─────────────────────
  const leadWhere: Prisma.LeadWhereInput = isSuperadmin ? {} : { assigneeId: profile.id };

  const [stages, leads] = await Promise.all([
    prisma.pipelineStage.findMany({ where: { isActive: true }, orderBy: { position: "asc" } }),
    prisma.lead.findMany({
      where: leadWhere,
      include: { stage: true, assignee: true },
    }),
  ]);

  const now = new Date();
  const today = startOfDay(now);
  const tomorrow = new Date(today.getTime() + DAY_MS);
  const in7Days = new Date(today.getTime() + 7 * DAY_MS);
  const fourteenDaysAgo = new Date(now.getTime() - 14 * DAY_MS);
  const sevenDaysAgo = new Date(now.getTime() - 7 * DAY_MS);

  const isOpen = (stageName: string) => !CLOSED_STAGE_NAMES.includes(stageName);

  // ─── KPIs ──────────────────────────────────────────────────────────────
  const totalLeads = leads.length;
  const closedWonLeads = leads.filter((l) => l.stage.name === CLOSED_WON);
  const closedLostLeads = leads.filter((l) => l.stage.name === CLOSED_LOST);
  const deadLeads = leads.filter((l) => l.stage.name === DEAD_LEAD);
  const winRateDenominator = closedWonLeads.length + closedLostLeads.length;
  const winRate = winRateDenominator > 0
    ? Math.round((closedWonLeads.length / winRateDenominator) * 100)
    : 0;

  const noActivityLeads = leads.filter(
    (l) => isOpen(l.stage.name) && (!l.lastActivityAt || l.lastActivityAt < fourteenDaysAgo)
  );
  const noStatusUpdateLeads = leads.filter(
    (l) => isOpen(l.stage.name) && (!l.stageChangedAt || l.stageChangedAt < sevenDaysAgo)
  );

  const openLeadsWithFollowUp = leads.filter((l) => isOpen(l.stage.name) && l.followUpDate);

  const missedFollowUps = openLeadsWithFollowUp
    .filter((l) => startOfDay(l.followUpDate as Date) < today)
    .sort((a, b) => (a.followUpDate as Date).getTime() - (b.followUpDate as Date).getTime());

  const todayFollowUps = openLeadsWithFollowUp
    .filter((l) => {
      const d = startOfDay(l.followUpDate as Date);
      return d.getTime() === today.getTime();
    })
    .sort((a, b) => {
      const at = a.followUpTime ? new Date(a.followUpTime).getTime() : 0;
      const bt = b.followUpTime ? new Date(b.followUpTime).getTime() : 0;
      return at - bt;
    });

  const upcomingFollowUps = openLeadsWithFollowUp
    .filter((l) => {
      const d = startOfDay(l.followUpDate as Date);
      return d.getTime() >= tomorrow.getTime() && d.getTime() <= in7Days.getTime();
    })
    .sort((a, b) => (a.followUpDate as Date).getTime() - (b.followUpDate as Date).getTime());

  // ─── Pipeline health ───────────────────────────────────────────────────
  const pipelineByStage = stages.map((stage) => {
    const stageLeads = leads.filter((l) => l.stageId === stage.id);
    const count = stageLeads.length;
    const pct = totalLeads > 0 ? Math.round((count / totalLeads) * 100) : 0;

    // NOTE: there's no stage-history table in the schema, so this is "average
    // time leads currently in this stage have been sitting there" (using
    // stageChangedAt, falling back to createdAt), not a true historical
    // average across every lead that has ever passed through the stage.
    const withDwell = stageLeads.map((l) => daysBetween(now, l.stageChangedAt ?? l.createdAt));
    const avgDays = withDwell.length > 0
      ? Math.round((withDwell.reduce((sum, d) => sum + d, 0) / withDwell.length) * 10) / 10
      : 0;

    return { stage: stage.name, count, pct, avgDays };
  });

  // ─── Team activity + lost reasons: superadmin only ────────────────────
  let teamActivity: {
    id: string;
    name: string;
    initials: string;
    callsToday: number;
    callsWeek: number;
    updatedToday: number;
    convRate: number;
  }[] | null = null;

  let lostReasons: { reason: string; count: number }[] | null = null;

  if (isSuperadmin) {
    const [activeUsers, activities] = await Promise.all([
      prisma.user.findMany({ where: { isActive: true } }),
      prisma.activity.findMany({ where: { createdAt: { gte: sevenDaysAgo } } }),
    ]);

    teamActivity = activeUsers.map((user) => {
      const userActivities = activities.filter((a) => a.loggedBy === user.id);
      const callsToday = userActivities.filter((a) => a.createdAt >= today).length;
      const callsWeek = userActivities.length; // already scoped to last 7 days
      const userLeads = leads.filter((l) => l.assigneeId === user.id); // all leads, unscoped by admin filter since superadmin here
      const updatedToday = userLeads.filter(
        (l) => l.lastActivityAt && l.lastActivityAt >= today
      ).length;
      const won = userLeads.filter((l) => l.stage.name === CLOSED_WON).length;
      const lost = userLeads.filter((l) => l.stage.name === CLOSED_LOST).length;
      const convRate = won + lost > 0 ? Math.round((won / (won + lost)) * 100) : 0;

      return {
        id: user.id,
        name: user.name,
        initials: user.name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase(),
        callsToday,
        callsWeek,
        updatedToday,
        convRate,
      };
    });

    const lostReasonCounts = new Map<string, number>();
    for (const lead of closedLostLeads) {
      const reason = lead.lostReason ?? "Unspecified";
      lostReasonCounts.set(reason, (lostReasonCounts.get(reason) ?? 0) + 1);
    }
    lostReasons = Array.from(lostReasonCounts.entries())
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count);
  }

  return NextResponse.json({
    role: profile.role,
    kpis: {
      totalLeads,
      closedWon: closedWonLeads.length,
      closedLost: closedLostLeads.length,
      deadLeads: deadLeads.length,
      winRate,
      noActivityCount: noActivityLeads.length,
      noStatusUpdateCount: noStatusUpdateLeads.length,
      missedFollowUpsCount: missedFollowUps.length,
    },
    followUps: {
      today: todayFollowUps.map(serializeLeadForFollowUp),
      missed: missedFollowUps.map(serializeLeadForFollowUp),
      upcoming: upcomingFollowUps.map(serializeLeadForFollowUp),
    },
    pipelineHealth: {
      totalLeads,
      overdueCount: missedFollowUps.length,
      stages: pipelineByStage,
    },
    teamActivity,
    lostReasons,
  });
}

function serializeLeadForFollowUp(lead: Prisma.LeadGetPayload<{ include: { stage: true; assignee: true } }>) {
  return {
    id: lead.id,
    company: lead.company,
    contact: lead.contact ?? "—",
    stage: lead.stage.name,
    followUpDate: lead.followUpDate,
    followUpTime: lead.followUpTime,
  };
}