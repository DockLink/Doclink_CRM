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

export function initials(name: string) {
  return name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase();
}

export function assigneeColor(name: string) {
  const colors = ["#2FBEB3", "#6366F1", "#F97316", "#16A34A", "#F59E0B", "#EC4899"];
  return colors[name.length % colors.length];
}

export function urgencyFor(date: string | null): LeadUrgency {
  if (!date) return "none";
  const target = new Date(date);
  if (Number.isNaN(target.getTime())) return "none";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const targetDay = new Date(target);
  targetDay.setHours(0, 0, 0, 0);
  if (targetDay < today) return "overdue";
  if (targetDay.getTime() === today.getTime()) return "today";
  return "upcoming";
}

export function displayDate(date: string | null) {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export function displayTime(date: string | null) {
  if (!date) return "—";
  return new Date(date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
}