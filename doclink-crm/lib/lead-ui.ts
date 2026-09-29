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

export function displayTime(date: string | null) {
  const minutes = followUpMinutes(date);
  if (minutes === null) return "—";
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}