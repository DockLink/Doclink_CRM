import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { CLOSED_LOST_OUTCOME, lostReasonCategory } from "@/lib/lost-reasons";
import { requireProfile, checkRateLimit } from "@/lib/api-auth"; // adjust import path to wherever requireProfile/checkRateLimit actually live
import { Prisma } from "../../../../generated/prisma/client"; // adjust relative depth if this file moves

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

// follow_up_date (DATE) and follow_up_time (TIME) hold the user's wall-clock
// values, surfaced by Prisma as UTC-midnight / 1970-01-01 UTC instants.
function dateKey(d: Date) {
  return d.toISOString().slice(0, 10);
}

function timeMinutes(t: Date | null) {
  return t ? t.getUTCHours() * 60 + t.getUTCMinutes() : null;
}

// Shifts `now` into the caller's wall clock using the browser's
// getTimezoneOffset() value, so its UTC components read as local time.
function userWallClock(request: Request, now: Date) {
  const raw = Number(new URL(request.url).searchParams.get("tzOffset"));
  const offset = Number.isFinite(raw) && Math.abs(raw) <= 14 * 60 ? raw : now.getTimezoneOffset();
  return new Date(now.getTime() - offset * 60_000);
}

// Timestamp columns are `timestamp without time zone` holding UTC, so JS
// instants are passed as epoch seconds and converted to UTC on the DB side.
function sqlTimestamp(d: Date) {
  return Prisma.sql`(to_timestamp(${d.getTime() / 1000}::float8) AT TIME ZONE 'UTC')`;
}

type LeadStatsRow = {
  stageId: string;
  assigneeId: string;
  count: number;
  dwellDays: number;
  noActivity: number;
  noStatusUpdate: number;
  updatedToday: number;
};

type ActivityStatsRow = {
  userId: string;
  callsToday: number;
  callsWeek: number;
};

const followUpLeadSelect = {
  id: true,
  company: true,
  contact: true,
  stageId: true,
  followUpDate: true,
  followUpTime: true,
} satisfies Prisma.LeadSelect;

type FollowUpLead = Prisma.LeadGetPayload<{ select: typeof followUpLeadSelect }>;

export async function GET(request: Request) {
  const limited = checkRateLimit(request, "dashboard");
  if (limited) return limited;

  const { profile, response } = await requireProfile(request);
  if (response) return response;

  const isSuperadmin = profile.role === "superadmin";

  const now = new Date();
  const today = startOfDay(now);
  const in7Days = new Date(today.getTime() + 7 * DAY_MS);
  const fourteenDaysAgo = new Date(now.getTime() - 14 * DAY_MS);
  const sevenDaysAgo = new Date(now.getTime() - 7 * DAY_MS);

  // ─── Scope: admin and superadmin both see company-wide data ──────────────
  // Every query below is independent, so they all run in a single parallel
  // batch. Lead-level aggregates are computed in Postgres, grouped by
  // (stage, assignee) so the row count is bounded by stages × users rather
  // than by the number of leads.
  const [stages, leadStats, followUpLeads, activeUsers, activityStats, lostReasonGroups] = await Promise.all([
    // All stages (including inactive) so any lead's stage name can be resolved;
    // only active ones are listed in pipeline health.
    prisma.pipelineStage.findMany({
      select: { id: true, name: true, isActive: true },
      orderBy: { position: "asc" },
    }),
    prisma.$queryRaw<LeadStatsRow[]>`
      SELECT
        stage_id AS "stageId",
        assignee_id AS "assigneeId",
        COUNT(*)::int AS "count",
        (SUM(ABS(EXTRACT(EPOCH FROM (${sqlTimestamp(now)} - COALESCE(stage_changed_at, created_at))))) / 86400)::float8 AS "dwellDays",
        COUNT(*) FILTER (WHERE last_activity_at IS NULL OR last_activity_at < ${sqlTimestamp(fourteenDaysAgo)})::int AS "noActivity",
        COUNT(*) FILTER (WHERE stage_changed_at IS NULL OR stage_changed_at < ${sqlTimestamp(sevenDaysAgo)})::int AS "noStatusUpdate",
        COUNT(*) FILTER (WHERE last_activity_at >= ${sqlTimestamp(today)})::int AS "updatedToday"
      FROM leads
      GROUP BY stage_id, assignee_id
    `,
    // Only open leads that can land in missed/today/upcoming. The DB bound is
    // deliberately loose (follow_up_date is a DATE); exact bucketing happens below.
    prisma.lead.findMany({
      where: {
        followUpDate: { lte: new Date(in7Days.getTime() + 2 * DAY_MS) },
        stage: { name: { notIn: CLOSED_STAGE_NAMES } },
      },
      select: followUpLeadSelect,
    }),
    isSuperadmin
      ? prisma.user.findMany({ where: { isActive: true }, select: { id: true, name: true } })
      : null,
    isSuperadmin
      ? prisma.$queryRaw<ActivityStatsRow[]>`
          SELECT
            logged_by AS "userId",
            COUNT(*) FILTER (WHERE created_at >= ${sqlTimestamp(today)})::int AS "callsToday",
            COUNT(*)::int AS "callsWeek"
          FROM activities
          WHERE created_at >= ${sqlTimestamp(sevenDaysAgo)}
            AND outcome <> ${CLOSED_LOST_OUTCOME}
          GROUP BY logged_by
        `
      : null,
    isSuperadmin
      ? prisma.lead.groupBy({
          by: ["lostReason"],
          where: { stage: { name: CLOSED_LOST } },
          _count: { _all: true },
        })
      : null,
  ]);

  const stageNameById = new Map(stages.map((s) => [s.id, s.name]));
  const isOpen = (stageName: string) => !CLOSED_STAGE_NAMES.includes(stageName);

  // ─── Single pass over the aggregated rows ──────────────────────────────
  let totalLeads = 0;
  let closedWon = 0;
  let closedLost = 0;
  let deadLeads = 0;
  let noActivityCount = 0;
  let noStatusUpdateCount = 0;
  const stageTotals = new Map<string, { count: number; dwellDays: number }>();
  const assigneeTotals = new Map<string, { updatedToday: number; won: number; lost: number }>();

  for (const row of leadStats) {
    const stageName = stageNameById.get(row.stageId) ?? "";
    totalLeads += row.count;
    if (stageName === CLOSED_WON) closedWon += row.count;
    if (stageName === CLOSED_LOST) closedLost += row.count;
    if (stageName === DEAD_LEAD) deadLeads += row.count;
    if (isOpen(stageName)) {
      noActivityCount += row.noActivity;
      noStatusUpdateCount += row.noStatusUpdate;
    }

    const stageTotal = stageTotals.get(row.stageId) ?? { count: 0, dwellDays: 0 };
    stageTotal.count += row.count;
    stageTotal.dwellDays += row.dwellDays;
    stageTotals.set(row.stageId, stageTotal);

    const assigneeTotal = assigneeTotals.get(row.assigneeId) ?? { updatedToday: 0, won: 0, lost: 0 };
    assigneeTotal.updatedToday += row.updatedToday;
    if (stageName === CLOSED_WON) assigneeTotal.won += row.count;
    if (stageName === CLOSED_LOST) assigneeTotal.lost += row.count;
    assigneeTotals.set(row.assigneeId, assigneeTotal);
  }

  // ─── KPIs ──────────────────────────────────────────────────────────────
  const winRateDenominator = closedWon + closedLost;
  const winRate = winRateDenominator > 0
    ? Math.round((closedWon / winRateDenominator) * 100)
    : 0;

  const missedFollowUps: FollowUpLead[] = [];
  const todayFollowUps: FollowUpLead[] = [];
  const upcomingFollowUps: FollowUpLead[] = [];
  const wallClock = userWallClock(request, now);
  const todayKey = dateKey(wallClock);
  const horizonKey = dateKey(new Date(wallClock.getTime() + 7 * DAY_MS));
  const nowMinutes = timeMinutes(wallClock) as number;
  for (const lead of followUpLeads) {
    const key = dateKey(lead.followUpDate as Date);
    if (key < todayKey) missedFollowUps.push(lead);
    else if (key === todayKey) {
      const minutes = timeMinutes(lead.followUpTime);
      if (minutes !== null && minutes < nowMinutes) missedFollowUps.push(lead);
      else todayFollowUps.push(lead);
    }
    else if (key <= horizonKey) upcomingFollowUps.push(lead);
  }

  const byDateThenTime = (a: FollowUpLead, b: FollowUpLead) =>
    (a.followUpDate as Date).getTime() - (b.followUpDate as Date).getTime() ||
    (timeMinutes(a.followUpTime) ?? 0) - (timeMinutes(b.followUpTime) ?? 0);
  missedFollowUps.sort(byDateThenTime);
  todayFollowUps.sort(byDateThenTime);
  upcomingFollowUps.sort(byDateThenTime);

  // ─── Pipeline health ───────────────────────────────────────────────────
  const pipelineByStage = stages
    .filter((stage) => stage.isActive)
    .map((stage) => {
      const { count, dwellDays } = stageTotals.get(stage.id) ?? { count: 0, dwellDays: 0 };
      const pct = totalLeads > 0 ? Math.round((count / totalLeads) * 100) : 0;

      // NOTE: there's no stage-history table in the schema, so this is "average
      // time leads currently in this stage have been sitting there" (using
      // stageChangedAt, falling back to createdAt), not a true historical
      // average across every lead that has ever passed through the stage.
      const avgDays = count > 0 ? Math.round((dwellDays / count) * 10) / 10 : 0;

      return { stage: stage.name, count, pct, avgDays };
    });

  // ─── Team activity + lost reasons: superadmin only (null for admin) ────
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

  if (isSuperadmin && activeUsers && activityStats && lostReasonGroups) {
    const activityByUser = new Map(activityStats.map((a) => [a.userId, a]));

    teamActivity = activeUsers.map((user) => {
      const activity = activityByUser.get(user.id);
      const leadTotals = assigneeTotals.get(user.id);
      const won = leadTotals?.won ?? 0;
      const lost = leadTotals?.lost ?? 0;
      const convRate = won + lost > 0 ? Math.round((won / (won + lost)) * 100) : 0;

      return {
        id: user.id,
        name: user.name,
        initials: user.name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase(),
        callsToday: activity?.callsToday ?? 0,
        callsWeek: activity?.callsWeek ?? 0,
        updatedToday: leadTotals?.updatedToday ?? 0,
        convRate,
      };
    });

    const lostReasonCounts = new Map<string, number>();
    for (const group of lostReasonGroups) {
      const reason = group.lostReason ? lostReasonCategory(group.lostReason) : "Unspecified";
      lostReasonCounts.set(reason, (lostReasonCounts.get(reason) ?? 0) + group._count._all);
    }
    lostReasons = Array.from(lostReasonCounts.entries())
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count);
  }

  const serializeLeadForFollowUp = (lead: FollowUpLead) => ({
    id: lead.id,
    company: lead.company,
    contact: lead.contact ?? "—",
    stage: stageNameById.get(lead.stageId) ?? "",
    followUpDate: lead.followUpDate,
    followUpTime: lead.followUpTime,
  });

  return NextResponse.json({
    role: profile.role,
    kpis: {
      totalLeads,
      closedWon,
      closedLost,
      deadLeads,
      winRate,
      noActivityCount,
      noStatusUpdateCount,
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
