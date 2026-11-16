import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { leadAccessWhere, requireProfile } from "@/lib/api-auth";
import { resolveDisplayFollowUp } from "@/lib/lead-ui";
import { Prisma } from "../../../../generated/prisma/client";

const CLOSED_STAGE_NAMES = ["Closed Won", "Closed Lost", "Dead Lead"];
const DAY_MS = 24 * 60 * 60 * 1000;

function dateKey(date: Date | string) {
  return (date instanceof Date ? date : new Date(date)).toISOString().slice(0, 10);
}

function timeMinutes(time: Date | string | null) {
  if (!time) return null;
  const value = time instanceof Date ? time : new Date(time);
  return Number.isNaN(value.getTime()) ? null : value.getUTCHours() * 60 + value.getUTCMinutes();
}

function userWallClock(request: Request, now: Date) {
  const raw = Number(new URL(request.url).searchParams.get("tzOffset"));
  const offset = Number.isFinite(raw) && Math.abs(raw) <= 14 * 60 ? raw : now.getTimezoneOffset();
  return new Date(now.getTime() - offset * 60_000);
}

const followUpSelect = {
  followUpDate: true,
  followUpTime: true,
  followUpUpdatedAt: true,
  proposalFollowUpDate: true,
  proposalFollowUpTime: true,
  proposalFollowUpUpdatedAt: true,
} satisfies Prisma.LeadSelect;

export async function GET(request: Request) {
  const { profile, response } = await requireProfile(request);
  if (response) return response;

  const now = new Date();
  const wallClock = userWallClock(request, now);
  const todayKey = dateKey(wallClock);
  const horizonKey = dateKey(new Date(wallClock.getTime() + 7 * DAY_MS));
  const nowMinutes = timeMinutes(wallClock);
  const horizonDate = new Date(new Date(todayKey).getTime() + 9 * DAY_MS);

  const leads = await prisma.lead.findMany({
    where: {
      ...leadAccessWhere(profile),
      OR: [
        { followUpDate: { not: null, lte: horizonDate } },
        { proposalFollowUpDate: { not: null, lte: horizonDate } },
      ],
      stage: { name: { notIn: CLOSED_STAGE_NAMES } },
    },
    select: followUpSelect,
  });

  let today = 0;
  let missed = 0;
  let upcoming = 0;
  for (const lead of leads) {
    const display = resolveDisplayFollowUp(lead);
    if (!display.date) continue;
    const key = dateKey(display.date);
    if (key < todayKey) {
      missed++;
    } else if (key === todayKey) {
      const minutes = timeMinutes(display.time);
      if (minutes !== null && minutes < (nowMinutes as number)) missed++;
      else today++;
    } else if (key <= horizonKey) {
      upcoming++;
    }
  }

  return NextResponse.json({ today, missed, upcoming });
}
