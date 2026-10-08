import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { leadAccessWhere, requireProfile } from "@/lib/api-auth";
import { Prisma } from "../../../../generated/prisma/client";

const CLOSED_STAGE_NAMES = ["Closed Won", "Closed Lost", "Dead Lead"];
const DAY_MS = 24 * 60 * 60 * 1000;

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function timeMinutes(time: Date | null) {
  return time ? time.getUTCHours() * 60 + time.getUTCMinutes() : null;
}

function userWallClock(request: Request, now: Date) {
  const raw = Number(new URL(request.url).searchParams.get("tzOffset"));
  const offset = Number.isFinite(raw) && Math.abs(raw) <= 14 * 60 ? raw : now.getTimezoneOffset();
  return new Date(now.getTime() - offset * 60_000);
}

const followUpSelect = {
  followUpDate: true,
  followUpTime: true,
} satisfies Prisma.LeadSelect;

export async function GET(request: Request) {
  const { profile, response } = await requireProfile(request);
  if (response) return response;

  const now = new Date();
  const wallClock = userWallClock(request, now);
  const todayKey = dateKey(wallClock);
  const horizonKey = dateKey(new Date(wallClock.getTime() + 7 * DAY_MS));
  const nowMinutes = timeMinutes(wallClock);

  const leads = await prisma.lead.findMany({
    where: {
      ...leadAccessWhere(profile),
      followUpDate: { not: null, lte: new Date(new Date(todayKey).getTime() + 9 * DAY_MS) },
      stage: { name: { notIn: CLOSED_STAGE_NAMES } },
    },
    select: followUpSelect,
  });

  let today = 0;
  let missed = 0;
  let upcoming = 0;
  for (const lead of leads) {
    const key = dateKey(lead.followUpDate as Date);
    if (key < todayKey) {
      missed++;
    } else if (key === todayKey) {
      const minutes = timeMinutes(lead.followUpTime);
      if (minutes !== null && minutes < (nowMinutes as number)) missed++;
      else today++;
    } else if (key <= horizonKey) {
      upcoming++;
    }
  }

  return NextResponse.json({ today, missed, upcoming });
}
