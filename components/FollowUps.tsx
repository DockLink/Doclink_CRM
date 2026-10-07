"use client";

import { useState, useRef, useEffect, useMemo, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { UserRole } from "@/lib/types";
import { type ApiLead, localDateKey, urgencyFor } from "@/lib/lead-ui";
import { stageColor } from "@/lib/pipeline-stages";
import { usePipelineStages } from "@/lib/use-pipeline-stages";
import { clearDraft, readDraft, useFormDraft } from "@/lib/use-form-draft";
import { LogCallModal, type LogCallForm } from "@/components/LogCallModal";

const rescheduleDraftKey = (leadId: string) => `lead:${leadId}:reschedule`;

// ─── Types ────────────────────────────────────────────────────────────────────

type Priority = "hot" | "warm" | "cold";
type Urgency = "overdue" | "today" | "upcoming";

interface FollowUp {
  id: string;
  company: string;
  contact: string;
  phone: string;
  priority: Priority;
  stage: string;
  niche: string;
  date: string;       // ISO yyyy-mm-dd
  time: string;       // "HH:MM" 24h
  timeLabel: string;  // "10:30 AM"
  urgency: Urgency;
  overdueLabel?: string; // "Overdue by 2h" | "Overdue by 1d"
  assignee: string;
  calls: number;
  notes: string;
}

function storedDateKey(iso: string | null) {
  return iso ? iso.slice(0, 10) : "";
}

function timeParts(iso: string | null) {
  if (!iso) return { sort: "99:99", label: "—" };
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return { sort: "99:99", label: "—" };
  const hours = date.getUTCHours();
  const minutes = date.getUTCMinutes();
  const period = hours >= 12 ? "PM" : "AM";
  const hour12 = hours % 12 || 12;
  return {
    sort: `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`,
    label: `${hour12}:${String(minutes).padStart(2, "0")} ${period}`,
  };
}

function overdueLabel(dateKey: string, time: string, now = new Date()) {
  if (dateKey === localDateKey(now) && time !== "99:99") {
    const [hours, minutes] = time.split(":").map(Number);
    const late = Math.max(1, now.getHours() * 60 + now.getMinutes() - (hours * 60 + minutes));
    return late < 60 ? `Overdue by ${late}m` : `Overdue by ${Math.floor(late / 60)}h`;
  }
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const [year, month, day] = dateKey.split("-").map(Number);
  const target = new Date(year, month - 1, day);
  const days = Math.max(1, Math.round((today.getTime() - target.getTime()) / 86_400_000));
  return `Overdue by ${days}d`;
}

function classify(dateKey: string, time: string, now = new Date()): Pick<FollowUp, "urgency" | "overdueLabel"> | null {
  const urgency = urgencyFor(
    `${dateKey}T00:00:00.000Z`,
    time === "99:99" ? null : `1970-01-01T${time}:00.000Z`,
    now,
  );
  if (urgency === "none") return null;
  if (urgency === "upcoming" && dateKey > localDateKey(new Date(now.getTime() + 7 * 86_400_000))) return null;
  return { urgency, overdueLabel: urgency === "overdue" ? overdueLabel(dateKey, time, now) : undefined };
}

function toFollowUp(lead: ApiLead): FollowUp | null {
  if (!lead.followUpDate) return null;
  const date = storedDateKey(lead.followUpDate);
  const time = timeParts(lead.followUpTime);
  const status = classify(date, time.sort);
  if (!status) return null;
  return {
    id: lead.id,
    company: lead.company,
    contact: lead.contact || "—",
    phone: lead.phone || "—",
    priority: lead.priority ?? "cold",
    stage: lead.stage,
    niche: lead.niche || "—",
    date,
    time: time.sort,
    timeLabel: time.label,
    ...status,
    assignee: lead.assigneeName,
    calls: lead.calls,
    notes: [outcomeLabel(lead.lastOutcome), lead.lastNotes].filter(Boolean).join(" — "),
  };
}

const PRIORITY_COLOR: Record<Priority, string> = {
  hot: "#EF4444",
  warm: "#F59E0B",
  cold: "#3B82F6",
};

const PRIORITY_LABEL: Record<Priority, string> = {
  hot: "Hot",
  warm: "Warm",
  cold: "Cold",
};

const OUTCOME_LABEL: Record<string, string> = {
  answered: "Answered",
  no_answer: "No Answer",
  callback_requested: "Callback Requested",
  proposal_discussed: "Proposal Discussed",
  meeting_set: "Meeting Set",
  closed_lost: "Closed Lost",
};

function outcomeLabel(outcome?: string) {
  if (!outcome) return "";
  return OUTCOME_LABEL[outcome] ?? outcome;
}

// ─── Date labels ──────────────────────────────────────────────────────────────

function dateSectionLabel(dateStr: string): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  const formatted = date.toLocaleDateString("en-US", { weekday: "long", day: "numeric", month: "short" });
  const tomorrow = new Date();
  tomorrow.setHours(0, 0, 0, 0);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (date.getTime() === tomorrow.getTime()) return `Tomorrow — ${formatted}`;
  return formatted;
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function PhoneIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1.17h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.74a16 16 0 0 0 6 6l.94-.94a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
    </svg>
  );
}

function KebabIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="5" r="1" fill="currentColor"/>
      <circle cx="12" cy="12" r="1" fill="currentColor"/>
      <circle cx="12" cy="19" r="1" fill="currentColor"/>
    </svg>
  );
}

function ClockIcon({ color = "currentColor" }: { color?: string }) {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="10"/>
      <polyline points="12 6 12 12 16 14"/>
    </svg>
  );
}

function EmptyCheckIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
      <polyline points="22 4 12 14.01 9 11.01"/>
    </svg>
  );
}

function UserIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
      <circle cx="12" cy="7" r="4"/>
    </svg>
  );
}

// ─── Kebab Menu ───────────────────────────────────────────────────────────────

function KebabMenu({
  onReschedule,
  onMarkDone,
  onViewLead,
}: {
  onReschedule: () => void;
  onMarkDone: () => void;
  onViewLead: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        className="flex items-center justify-center rounded-lg"
        style={{ width: 32, height: 32, color: "#9CA3AF", background: open ? "#F3F4F6" : "transparent" }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#F3F4F6"; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = open ? "#F3F4F6" : "transparent"; }}
      >
        <KebabIcon />
      </button>
      {open && (
        <div
          className="absolute right-0 z-30 rounded-lg overflow-hidden"
          style={{ top: "calc(100% + 4px)", minWidth: 160, background: "#FFFFFF", boxShadow: "0 4px 16px rgba(15,27,60,0.12)", border: "1px solid #E3E7EF" }}
        >
          {[
            { label: "Reschedule", action: onReschedule },
            { label: "Mark as Done", action: onMarkDone },
            { label: "View Lead", action: onViewLead },
          ].map(({ label, action }) => (
            <button
              key={label}
              onClick={(e) => { e.stopPropagation(); action(); setOpen(false); }}
              className="w-full text-left px-4 py-2.5"
              style={{ fontSize: 13, color: "#374151" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#F9FAFB"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Follow-up Row ────────────────────────────────────────────────────────────

function FollowUpRow({
  lead,
  variant,
  onClick,
  onCall,
  onReschedule,
  onMarkDone,
}: {
  lead: FollowUp;
  variant: "today" | "overdue" | "upcoming";
  onClick: () => void;
  onCall: () => void;
  onReschedule: () => void;
  onMarkDone: () => void;
}) {
  const { stages } = usePipelineStages();
  const color = stageColor(stages, lead.stage);
  const rowBg =
    variant === "overdue" ? "#FFF8F8" :
    variant === "today" ? "#FFFFFF" :
    "#FFFFFF";

  const borderLeft =
    variant === "overdue" ? "3px solid #DC2626" : "3px solid transparent";

  return (
    <div
      onClick={onClick}
      className="flex items-center gap-4 px-5 py-3.5 cursor-pointer"
      style={{ background: rowBg, borderLeft, borderBottom: "1px solid #F3F4F6", transition: "background 150ms" }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = variant === "overdue" ? "#FFF0F0" : "#F9FAFB"; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = rowBg; }}
    >
      {/* Time / overdue chip */}
      <div style={{ width: 112, flexShrink: 0 }}>
        {variant === "overdue" ? (
          <span
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full"
            style={{ background: "#FEE2E2", color: "#DC2626", fontSize: 11, fontWeight: 600, whiteSpace: "nowrap" }}
          >
            <ClockIcon color="#DC2626" />
            {lead.overdueLabel}
          </span>
        ) : (
          <span style={{ fontSize: 14, fontWeight: 700, color: "#111111" }}>{lead.timeLabel}</span>
        )}
      </div>

      {/* Company + niche */}
      <div style={{ flex: "0 0 240px" }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: "#111111", marginBottom: 1 }}>{lead.company}</p>
        <p className="flex items-center gap-1.5" style={{ fontSize: 11, color: "#6B7280" }}>
          <span>{lead.niche}</span>
          <span className="px-1.5 py-0.5 rounded-full" style={{ background: `${color}22`, color, fontWeight: 600 }}>
            {lead.stage}
          </span>
        </p>
        {lead.notes && (
          <p style={{ fontSize: 11, color: "#374151", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{lead.notes}</p>
        )}
      </div>

      {/* Contact + phone */}
      <div style={{ flex: "0 0 170px" }}>
        <p className="flex items-center gap-1" style={{ fontSize: 13, color: "#374151", marginBottom: 2 }}>
          <UserIcon /> {lead.contact}
        </p>
        <p className="flex items-center gap-1" style={{ fontSize: 11, color: "#6B7280" }}>
          <PhoneIcon /> {lead.phone}
        </p>
      </div>

      {/* Priority dot */}
      <div className="flex items-center gap-1.5" style={{ flex: "0 0 64px" }}>
        <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: PRIORITY_COLOR[lead.priority] }} />
        <span style={{ fontSize: 11, fontWeight: 500, color: PRIORITY_COLOR[lead.priority] }}>{PRIORITY_LABEL[lead.priority]}</span>
      </div>

      {/* Assignee */}
      <div style={{ flex: 1, fontSize: 12, color: "#6B7280", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {lead.assignee}
      </div>

      <span
        className="shrink-0 px-2 py-1 rounded-full"
        style={{ fontSize: 11, fontWeight: 700, color: "#0E7A70", background: "#E3F7F5" }}
      >
        {lead.calls} {lead.calls === 1 ? "call" : "calls"}
      </span>

      {/* Actions */}
      <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          onClick={onCall}
          className="flex items-center gap-1.5 rounded-lg font-semibold"
          style={{ height: 32, paddingInline: 12, border: "1.5px solid #2FBEB3", color: "#0E7A70", fontSize: 12, background: "transparent" }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#E3F7F5"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
        >
          <PhoneIcon /> Call Now
        </button>
        <KebabMenu onReschedule={onReschedule} onMarkDone={onMarkDone} onViewLead={onClick} />
      </div>
    </div>
  );
}

// ─── Section card ─────────────────────────────────────────────────────────────

function SectionCard({
  id,
  children,
  accentLeft,
}: {
  id?: string;
  children: ReactNode;
  accentLeft?: string;
}) {
  return (
    <div
      id={id}
      className="rounded-xl overflow-hidden"
      style={{
        background: "#FFFFFF",
        border: "1px solid #E3E7EF",
        boxShadow: "0 1px 4px rgba(15,27,60,0.06)",
        borderLeft: accentLeft ? `4px solid ${accentLeft}` : undefined,
      }}
    >
      {children}
    </div>
  );
}

function SectionHeader({
  title,
  count,
  accentColor,
}: {
  title: string;
  count: number;
  accentColor?: string;
}) {
  return (
    <div
      className="flex items-center gap-3 px-5 py-4"
      style={{ borderBottom: "1px solid #E3E7EF" }}
    >
      <h2 style={{ fontSize: 15, fontWeight: 700, color: "#111111" }}>{title}</h2>
      <span
        className="flex items-center justify-center rounded-full"
        style={{
          minWidth: 24,
          height: 24,
          paddingInline: 8,
          background: accentColor ? `${accentColor}18` : "#E3F7F5",
          color: accentColor ?? "#0E7A70",
          fontSize: 12,
          fontWeight: 700,
        }}
      >
        {count}
      </span>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

function RescheduleModal({
  lead,
  onClose,
  onSave,
}: {
  lead: FollowUp;
  onClose: () => void;
  onSave: (date: string, time: string) => void;
}) {
  const scheduledTime = lead.time === "99:99" ? "" : lead.time;
  const [initial] = useState(() => ({ date: lead.date, time: scheduledTime, ...readDraft<{ date: string; time: string }>(rescheduleDraftKey(lead.id)) }));
  const [date, setDate] = useState(initial.date);
  const [time, setTime] = useState(initial.time);
  const [error, setError] = useState("");
  const schedule = useMemo(() => ({ date, time }), [date, time]);
  const clearScheduleDraft = useFormDraft(rescheduleDraftKey(lead.id), schedule, {
    isEmpty: (value) => value.date === lead.date && value.time === scheduledTime,
  });

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center" style={{ background: "rgba(15,27,60,0.45)" }} onClick={onClose}>
      <div
        className="flex flex-col"
        style={{ width: 420, background: "#FFFFFF", borderRadius: 12, border: "1px solid #E3E7EF", boxShadow: "0 8px 48px rgba(15,27,60,0.18)" }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="px-6 py-4" style={{ borderBottom: "1px solid #E3E7EF" }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: "#111111" }}>Reschedule — {lead.company}</h3>
          <p style={{ fontSize: 12, color: "#6B7280", marginTop: 4 }}>Updates the follow-up on this pipeline lead.</p>
        </div>
        <div className="px-6 py-5 flex gap-3">
          <label className="flex-1" style={{ fontSize: 11, fontWeight: 600, color: "#6B7280" }}>
            Date
            <input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="w-full rounded-lg px-3 mt-1.5" style={{ height: 36, border: "1.5px solid #E3E7EF", fontSize: 13, color: "#111111" }} />
          </label>
          <label className="flex-1" style={{ fontSize: 11, fontWeight: 600, color: "#6B7280" }}>
            Time
            <input type="time" value={time} onChange={(event) => setTime(event.target.value)} className="w-full rounded-lg px-3 mt-1.5" style={{ height: 36, border: "1.5px solid #E3E7EF", fontSize: 13, color: "#111111" }} />
          </label>
        </div>
        {error && <p className="px-6" style={{ fontSize: 12, color: "#DC2626", marginTop: -8 }}>{error}</p>}
        <div className="flex justify-end gap-3 px-6 py-4" style={{ borderTop: "1px solid #E3E7EF" }}>
          <button type="button" onClick={() => { clearScheduleDraft(); onClose(); }} className="rounded-lg font-semibold" style={{ height: 36, paddingInline: 16, fontSize: 13, background: "#F3F4F6", color: "#374151" }}>Cancel</button>
          <button
            type="button"
            className="rounded-lg font-semibold"
            style={{ height: 36, paddingInline: 16, fontSize: 13, background: "#2FBEB3", color: "#FFFFFF" }}
            onClick={() => {
              if (!date || !time) {
                setError("Date and time are required.");
                return;
              }
              onSave(date, time);
            }}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

export function FollowUps({ role }: { role: UserRole }) {
  void role;
  const router = useRouter();
  const [items, setItems] = useState<FollowUp[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [callLead, setCallLead] = useState<FollowUp | null>(null);
  const [rescheduleLead, setRescheduleLead] = useState<FollowUp | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const response = await fetch("/api/leads?followups=1");
        const result = await response.json() as { leads?: ApiLead[]; error?: string };
        if (!response.ok) {
          setError(result.error ?? "Unable to load follow-ups.");
          return;
        }
        setItems((result.leads ?? []).map(toFollowUp).filter((lead): lead is FollowUp => lead !== null));
      } catch {
        setError("Unable to reach the server. Please refresh and try again.");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const now = new Date();
      setItems((prev) => prev.flatMap((item) => {
        const status = classify(item.date, item.time, now);
        return status ? [{ ...item, ...status }] : [];
      }));
    }, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (loading) return;
    const hash = window.location.hash.slice(1);
    if (hash) document.getElementById(hash)?.scrollIntoView({ block: "start" });
  }, [loading]);

  const openLeadDetails = (lead: FollowUp) => router.push(`/leads/${lead.id}`);

  const patchFollowUp = async (leadId: string, followUpDate: string | null, followUpTime: string | null) => {
    const response = await fetch(`/api/leads/${leadId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ followUpDate, followUpTime }),
    });
    if (!response.ok) {
      const result = await response.json().catch(() => ({})) as { error?: string };
      throw new Error(result.error ?? "Unable to update the follow-up.");
    }
  };

  const applySchedule = (leadId: string, date: string, time: string) => {
    const clock = timeParts(`1970-01-01T${time}:00.000Z`);
    const status = classify(date, clock.sort);
    setItems((prev) => prev.flatMap((item) => {
      if (item.id !== leadId) return [item];
      if (!status) return [];
      return [{
        ...item,
        date,
        time: clock.sort,
        timeLabel: clock.label,
        ...status,
      }];
    }));
  };

  const handleLogCall = async (data: LogCallForm) => {
    if (!callLead || !data.outcome) return;
    const completeFollowUp = callLead.urgency === "overdue" && !data.followUpDate && !data.followUpTime;
    const response = await fetch("/api/activities", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        leadId: callLead.id,
        outcome: data.outcome,
        notes: data.notes,
        followUpDate: data.followUpDate || undefined,
        followUpTime: data.followUpTime || undefined,
        completeFollowUp,
      }),
    });
    const result = await response.json().catch(() => ({})) as { error?: string; calls?: number };
    if (!response.ok) throw new Error(result.error ?? "Unable to save the call log.");
    if (completeFollowUp) {
      setItems((prev) => prev.filter((item) => item.id !== callLead.id));
      setError("");
      return;
    }
    const calls = result.calls ?? callLead.calls + 1;
    const note = [outcomeLabel(data.outcome), data.notes].filter(Boolean).join(" — ");
    setItems((prev) => prev.map((item) => item.id === callLead.id ? { ...item, calls, notes: note } : item));
    if (data.followUpDate && data.followUpTime) {
      applySchedule(callLead.id, data.followUpDate, data.followUpTime);
    }
    setError("");
  };

  const handleReschedule = async (date: string, time: string) => {
    if (!rescheduleLead) return;
    try {
      await patchFollowUp(rescheduleLead.id, date, time);
      clearDraft(rescheduleDraftKey(rescheduleLead.id));
      applySchedule(rescheduleLead.id, date, time);
      setRescheduleLead(null);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to reschedule this follow-up.");
    }
  };

  const handleMarkDone = async (lead: FollowUp) => {
    try {
      await patchFollowUp(lead.id, null, null);
      setItems((prev) => prev.filter((item) => item.id !== lead.id));
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to complete this follow-up.");
    }
  };

  const todays = items.filter((f) => f.urgency === "today").sort((a, b) => a.time.localeCompare(b.time));
  const missed = items.filter((f) => f.urgency === "overdue").sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  const upcoming = items.filter((f) => f.urgency === "upcoming").sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));

  // Group upcoming by date
  const upcomingByDate: Record<string, FollowUp[]> = {};
  for (const f of upcoming) {
    if (!upcomingByDate[f.date]) upcomingByDate[f.date] = [];
    upcomingByDate[f.date].push(f);
  }
  const upcomingDates = Object.keys(upcomingByDate).sort();

  const rowProps = (lead: FollowUp) => ({
    lead,
    onClick: () => openLeadDetails(lead),
    onCall: () => setCallLead(lead),
    onReschedule: () => setRescheduleLead(lead),
    onMarkDone: () => { void handleMarkDone(lead); },
  });

  return (
    <div style={{ padding: "24px 28px", display: "flex", flexDirection: "column", gap: 20, maxWidth: 1100 }}>
      {loading && <p style={{ fontSize: 13, color: "#6B7280" }}>Loading follow-ups...</p>}
      {error && <p style={{ fontSize: 13, color: "#DC2626" }}>{error}</p>}

      {/* ── Section 1: Today */}
      <SectionCard id="today">
        <SectionHeader title="Today's Follow-ups" count={todays.length} />
        {todays.length === 0 ? (
          <EmptyState message="No follow-ups scheduled for today." />
        ) : (
          <div>
            {todays.map((lead) => (
              <FollowUpRow key={lead.id} variant="today" {...rowProps(lead)} />
            ))}
          </div>
        )}
      </SectionCard>

      {/* ── Section 2: Missed */}
      <SectionCard id="missed" accentLeft="#DC2626">
        <SectionHeader title="Missed Follow-ups" count={missed.length} accentColor="#DC2626" />
        {missed.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-12">
            <EmptyCheckIcon />
            <p style={{ fontSize: 14, color: "#6B7280", textAlign: "center", maxWidth: 300, lineHeight: 1.6 }}>
              No missed follow-ups — great job staying on top of things!
            </p>
          </div>
        ) : (
          <div>
            {missed.map((lead) => (
              <FollowUpRow key={lead.id} variant="overdue" {...rowProps(lead)} />
            ))}
          </div>
        )}
      </SectionCard>

      {/* ── Section 3: Upcoming */}
      <SectionCard id="upcoming">
        <SectionHeader title="Upcoming Follow-ups" count={upcoming.length} />
        {upcomingDates.length === 0 ? (
          <EmptyState message="No upcoming follow-ups in the next 7 days." />
        ) : (
          <div>
            {upcomingDates.map((date, di) => (
              <div key={date}>
                {/* Date sub-header */}
                <div
                  className="px-5 py-2.5 flex items-center gap-2"
                  style={{
                    background: "#F9FAFB",
                    borderBottom: "1px solid #F3F4F6",
                    borderTop: di > 0 ? "1px solid #E3E7EF" : undefined,
                  }}
                >
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.07em" }}>
                    {dateSectionLabel(date)}
                  </span>
                  <span
                    className="flex items-center justify-center rounded-full"
                    style={{ width: 18, height: 18, background: "#E3F7F5", color: "#0E7A70", fontSize: 10, fontWeight: 700 }}
                  >
                    {upcomingByDate[date].length}
                  </span>
                </div>
                {upcomingByDate[date].map((lead) => (
                  <FollowUpRow key={lead.id} variant="upcoming" {...rowProps(lead)} />
                ))}
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {callLead && (
        <LogCallModal
          leadId={callLead.id}
          companyName={callLead.company}
          onClose={() => setCallLead(null)}
          onSave={handleLogCall}
        />
      )}
      {rescheduleLead && (
        <RescheduleModal
          lead={rescheduleLead}
          onClose={() => setRescheduleLead(null)}
          onSave={(date, time) => { void handleReschedule(date, time); }}
        />
      )}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center py-10">
      <p style={{ fontSize: 13, color: "#6B7280" }}>{message}</p>
    </div>
  );
}

export default FollowUps;
