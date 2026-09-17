"use client";

import { useState, useRef, useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { UserRole } from "@/lib/types";

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

// ─── Mock data ────────────────────────────────────────────────────────────────

const TODAY_DATE = "2026-09-15";

const ALL_FOLLOWUPS: FollowUp[] = [
  // ── Today
  { id: "t1", company: "Meridian Corp",    contact: "Sarah Blake",  phone: "+1 555 340 9921", priority: "hot",  stage: "Conversation",   niche: "Enterprise SaaS", date: TODAY_DATE, time: "09:00", timeLabel: "9:00 AM",  urgency: "today",    assignee: "James Carter",  calls: 5,  notes: "Decision maker confirmed budget. Push for close." },
  { id: "t2", company: "Vanguard Tech",    contact: "Raj Patel",    phone: "+1 555 991 2254", priority: "warm", stage: "Proposal Sent",  niche: "Deep Tech",       date: TODAY_DATE, time: "10:30", timeLabel: "10:30 AM", urgency: "today",    assignee: "Derek Kim",     calls: 4,  notes: "Follow up on proposal, ask about concerns." },
  { id: "t3", company: "Ironbridge Group", contact: "Paul Denton",  phone: "+1 555 382 9901", priority: "hot",  stage: "Estimate Sent",  niche: "Infrastructure",  date: TODAY_DATE, time: "11:00", timeLabel: "11:00 AM", urgency: "today",    assignee: "James Carter",  calls: 7,  notes: "Sent revised estimate yesterday. Confirm receipt." },
  { id: "t4", company: "Atlas Holdings",   contact: "Carlos Ruiz",  phone: "+1 555 771 5543", priority: "warm", stage: "Try Again",      niche: "Real Estate",     date: TODAY_DATE, time: "13:30", timeLabel: "1:30 PM",  urgency: "today",    assignee: "Natalie Wong",  calls: 3,  notes: "Third attempt. Try a different angle." },
  { id: "t5", company: "Crestline Labs",   contact: "Priya Singh",  phone: "+1 555 443 0091", priority: "hot",  stage: "No Answer",      niche: "Pharma",          date: TODAY_DATE, time: "14:00", timeLabel: "2:00 PM",  urgency: "today",    assignee: "Aisha Santos",  calls: 2,  notes: "No answer twice. Try this slot." },
  { id: "t6", company: "Solaris Group",    contact: "Emma Novak",   phone: "+1 555 508 1177", priority: "cold", stage: "Conversation",   niche: "Clean Energy",    date: TODAY_DATE, time: "16:00", timeLabel: "4:00 PM",  urgency: "today",    assignee: "Marco Rivera",  calls: 4,  notes: "Scheduled by lead last week." },

  // ── Missed / Overdue
  { id: "m1", company: "Pinnacle Health",  contact: "Diane Yuen",   phone: "+1 555 219 6644", priority: "warm", stage: "Conversation",   niche: "Healthcare",      date: "2026-09-14", time: "16:00", timeLabel: "4:00 PM",  urgency: "overdue", overdueLabel: "Overdue by 22h", assignee: "Aisha Santos",  calls: 3,  notes: "Was meant to close the loop on pricing." },
  { id: "m2", company: "Nexus Digital",    contact: "Tom Brennan",  phone: "+1 555 774 3300", priority: "hot",  stage: "Proposal Sent",  niche: "Agency",          date: "2026-09-14", time: "11:00", timeLabel: "11:00 AM", urgency: "overdue", overdueLabel: "Overdue by 1d",  assignee: "James Carter",  calls: 6,  notes: "Proposal follow-up. High priority — hot lead." },
  { id: "m3", company: "Orion Partners",   contact: "Julia Chen",   phone: "+1 555 662 7712", priority: "warm", stage: "No Answer",      niche: "Logistics",       date: "2026-09-13", time: "09:00", timeLabel: "9:00 AM",  urgency: "overdue", overdueLabel: "Overdue by 2d",  assignee: "Derek Kim",     calls: 1,  notes: "Reached once but no callback. Escalate." },

  // ── Upcoming (next 7 days, grouped by date)
  { id: "u1", company: "Summit Partners",  contact: "Keiko Tanaka", phone: "+1 555 663 4410", priority: "warm", stage: "Meeting Booked", niche: "Consulting",      date: "2026-09-16", time: "14:00", timeLabel: "2:00 PM",  urgency: "upcoming", assignee: "Aisha Santos",  calls: 5,  notes: "Meeting confirmed. Prep deck." },
  { id: "u2", company: "Vertex Systems",   contact: "Angela Park",  phone: "+1 555 201 4432", priority: "cold", stage: "New Lead",       niche: "SaaS",            date: "2026-09-17", time: "09:00", timeLabel: "9:00 AM",  urgency: "upcoming", assignee: "James Carter",  calls: 0,  notes: "First outreach. Research company before call." },
  { id: "u3", company: "Clearpath Media",  contact: "Sofia Reyes",  phone: "+1 555 114 5530", priority: "warm", stage: "Estimate Sent",  niche: "Marketing",       date: "2026-09-20", time: "10:00", timeLabel: "10:00 AM", urgency: "upcoming", assignee: "Natalie Wong",  calls: 5,  notes: "Follow up on estimate sent 15 Sep." },
  { id: "u4", company: "Redwood Capital",  contact: "Marcus Webb",  phone: "+1 555 430 8823", priority: "warm", stage: "Conversation",   niche: "Investment",      date: "2026-09-18", time: "13:00", timeLabel: "1:00 PM",  urgency: "upcoming", assignee: "Natalie Wong",  calls: 2,  notes: "Revisit ROI numbers." },
  { id: "u5", company: "Luminary Co.",     contact: "Ben Howell",   phone: "+1 555 887 3310", priority: "cold", stage: "New Lead",       niche: "Fintech",         date: "2026-09-16", time: "11:00", timeLabel: "11:00 AM", urgency: "upcoming", assignee: "Marco Rivera",  calls: 0,  notes: "Cold lead. Introduce service briefly." },
  { id: "u6", company: "Crestview Corp",   contact: "Liam O'Brien", phone: "+1 555 335 7720", priority: "cold", stage: "Closed Lost",    niche: "Retail",          date: "2026-09-21", time: "11:00", timeLabel: "11:00 AM", urgency: "upcoming", assignee: "Marco Rivera",  calls: 3,  notes: "Re-engagement check-in after 30 days." },
];

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

// ─── Date labels ──────────────────────────────────────────────────────────────

function dateSectionLabel(dateStr: string): string {
  const map: Record<string, string> = {
    "2026-09-16": "Tomorrow — Wed, 16 Sep",
    "2026-09-17": "Thursday, 17 Sep",
    "2026-09-18": "Friday, 18 Sep",
    "2026-09-19": "Saturday, 19 Sep",
    "2026-09-20": "Sunday, 20 Sep",
    "2026-09-21": "Monday, 21 Sep",
  };
  return map[dateStr] ?? dateStr;
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

function KebabMenu({ onReschedule, onMarkDone }: { onReschedule: () => void; onMarkDone: () => void }) {
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
            { label: "View Lead", action: () => {} },
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
}: {
  lead: FollowUp;
  variant: "today" | "overdue" | "upcoming";
  onClick: () => void;
}) {
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
      <div style={{ flex: "0 0 180px" }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: "#111111", marginBottom: 1 }}>{lead.company}</p>
        <p style={{ fontSize: 11, color: "#6B7280" }}>{lead.niche}</p>
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

      {/* Actions */}
      <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
        <button
          className="flex items-center gap-1.5 rounded-lg font-semibold"
          style={{ height: 32, paddingInline: 12, border: "1.5px solid #2FBEB3", color: "#0E7A70", fontSize: 12, background: "transparent" }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#E3F7F5"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
        >
          <PhoneIcon /> Call Now
        </button>
        <KebabMenu onReschedule={() => {}} onMarkDone={() => {}} />
      </div>
    </div>
  );
}

// ─── Section card ─────────────────────────────────────────────────────────────

function SectionCard({
  children,
  accentLeft,
}: {
  children: ReactNode;
  accentLeft?: string;
}) {
  return (
    <div
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

export function FollowUps({ role }: { role: UserRole }) {
  const router = useRouter();
  const openLeadDetails = (lead: FollowUp) => router.push(`/leads/${lead.id}`);

  const todays = ALL_FOLLOWUPS.filter((f) => f.urgency === "today").sort((a, b) => a.time.localeCompare(b.time));
  const missed = ALL_FOLLOWUPS.filter((f) => f.urgency === "overdue").sort((a, b) => a.date.localeCompare(b.date));
  const upcoming = ALL_FOLLOWUPS.filter((f) => f.urgency === "upcoming").sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));

  // Group upcoming by date
  const upcomingByDate: Record<string, FollowUp[]> = {};
  for (const f of upcoming) {
    if (!upcomingByDate[f.date]) upcomingByDate[f.date] = [];
    upcomingByDate[f.date].push(f);
  }
  const upcomingDates = Object.keys(upcomingByDate).sort();

  return (
    <div style={{ padding: "24px 28px", display: "flex", flexDirection: "column", gap: 20, maxWidth: 1100 }}>

      {/* ── Section 1: Today */}
      <SectionCard>
        <SectionHeader title="Today's Follow-ups" count={todays.length} />
        {todays.length === 0 ? (
          <EmptyState message="No follow-ups scheduled for today." />
        ) : (
          <div>
            {todays.map((lead) => (
              <FollowUpRow key={lead.id} lead={lead} variant="today" onClick={() => openLeadDetails(lead)} />
            ))}
          </div>
        )}
      </SectionCard>

      {/* ── Section 2: Missed */}
      <SectionCard accentLeft="#DC2626">
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
              <FollowUpRow key={lead.id} lead={lead} variant="overdue" onClick={() => openLeadDetails(lead)} />
            ))}
          </div>
        )}
      </SectionCard>

      {/* ── Section 3: Upcoming */}
      <SectionCard>
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
                  <FollowUpRow key={lead.id} lead={lead} variant="upcoming" onClick={() => openLeadDetails(lead)} />
                ))}
              </div>
            ))}
          </div>
        )}
      </SectionCard>
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
