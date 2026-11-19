export type LeadPriority = "hot" | "warm" | "cold";
export type LeadUrgency = "overdue" | "today" | "upcoming" | "none";

export interface ApiLead {
  id: string;
  company: string;
  niche: string;
  contact: string;
  phone: string;
  priority: LeadPriority | null;
  followUpDate: string | null;
  followUpTime: string | null;
  stage: string;
  assigneeName: string;
  source: string;
  calls: number;
  lastOutcome?: string;
  lastNotes?: string;
  createdAt: string;
  stageChangedAt: string | null;
}

const HOT_STAGES = new Set(["closed won"]);
const COLD_STAGES = new Set(["new lead", "no answer", "try again", "closed lost", "dead lead"]);

export function priorityForStage(stage: string): LeadPriority {
  const key = stage.trim().toLowerCase();
  if (HOT_STAGES.has(key)) return "hot";
  if (COLD_STAGES.has(key)) return "cold";
  return "warm";
}

export function initials(name: string) {
  return name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase();
}

export function assigneeColor(name: string) {
  const colors = ["#2FBEB3", "#6366F1", "#F97316", "#16A34A", "#F59E0B", "#EC4899"];
  return colors[name.length % colors.length];
}

export function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// follow_up_date (DATE) and follow_up_time (TIME) are wall-clock values
// serialized as UTC ISO strings, so their UTC components are what the user entered.
export function followUpMinutes(time: string | null) {
  if (!time) return null;
  const d = new Date(time);
  if (Number.isNaN(d.getTime())) return null;
  return d.getUTCHours() * 60 + d.getUTCMinutes();
}

export function urgencyFor(date: string | null, time: string | null = null, now = new Date()): LeadUrgency {
  if (!date) return "none";
  const target = new Date(date);
  if (Number.isNaN(target.getTime())) return "none";
  const targetKey = target.toISOString().slice(0, 10);
  const todayKey = localDateKey(now);
  if (targetKey < todayKey) return "overdue";
  if (targetKey > todayKey) return "upcoming";
  const minutes = followUpMinutes(time);
  if (minutes !== null && minutes < now.getHours() * 60 + now.getMinutes()) return "overdue";
  return "today";
}

export function displayDate(date: string | null) {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

/** Formats YYYY-MM-DD (+ optional HH:MM) into a Last Contacted / activity note line. */
export function formatFollowUpScheduleNote(followUpDate: string, followUpTime?: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(followUpDate.trim());
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  const dateLabel = date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  const time = followUpTime?.trim();
  if (time) return `Follow-up scheduled for ${dateLabel} at ${time}`;
  return `Follow-up scheduled for ${dateLabel}`;
}

export function displayTime(date: string | null) {
  const minutes = followUpMinutes(date);
  if (minutes === null) return "—";
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

export type FollowUpSides = {
  followUpDate: Date | string | null;
  followUpTime: Date | string | null;
  followUpUpdatedAt?: Date | string | null;
  proposalFollowUpDate: Date | string | null;
  proposalFollowUpTime: Date | string | null;
  proposalFollowUpUpdatedAt?: Date | string | null;
};

function toMs(value: Date | string | null | undefined): number | null {
  if (!value) return null;
  const ms = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isNaN(ms) ? null : ms;
}

function toIso(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

type FollowUpCandidate = {
  date: string;
  time: string | null;
  updatedAt: number | null;
};

function followUpCandidates(lead: FollowUpSides): FollowUpCandidate[] {
  const candidates: FollowUpCandidate[] = [];
  const generalDate = toIso(lead.followUpDate);
  if (generalDate) {
    candidates.push({
      date: generalDate,
      time: toIso(lead.followUpTime),
      updatedAt: toMs(lead.followUpUpdatedAt),
    });
  }
  const proposalDate = toIso(lead.proposalFollowUpDate);
  if (proposalDate) {
    candidates.push({
      date: proposalDate,
      time: toIso(lead.proposalFollowUpTime),
      updatedAt: toMs(lead.proposalFollowUpUpdatedAt),
    });
  }
  return candidates;
}

function candidateDateKey(date: string) {
  return date.slice(0, 10);
}

function candidateMinutes(time: string | null) {
  return followUpMinutes(time) ?? 0;
}

/**
 * Pick the follow-up schedule to show in list/kanban/dashboard views.
 * Prefer the nearest today-or-future date (general vs proposal); if none remain,
 * fall back to the overdue date closest to today.
 */
export function resolveDisplayFollowUp(
  lead: FollowUpSides,
  now = new Date(),
): { date: string | null; time: string | null } {
  const candidates = followUpCandidates(lead);
  if (candidates.length === 0) return { date: null, time: null };
  if (candidates.length === 1) return { date: candidates[0].date, time: candidates[0].time };

  const todayKey = localDateKey(now);
  const upcoming = candidates.filter((c) => candidateDateKey(c.date) >= todayKey);
  const pool = upcoming.length > 0 ? upcoming : candidates;
  const preferSoonest = upcoming.length > 0;

  pool.sort((a, b) => {
    const aKey = candidateDateKey(a.date);
    const bKey = candidateDateKey(b.date);
    if (aKey !== bKey) return preferSoonest ? aKey.localeCompare(bKey) : bKey.localeCompare(aKey);

    const aMinutes = candidateMinutes(a.time);
    const bMinutes = candidateMinutes(b.time);
    if (aMinutes !== bMinutes) return preferSoonest ? aMinutes - bMinutes : bMinutes - aMinutes;

    // Same date/time: prefer whichever schedule was edited most recently.
    return (b.updatedAt ?? 0) - (a.updatedAt ?? 0);
  });

  return { date: pool[0].date, time: pool[0].time };
}