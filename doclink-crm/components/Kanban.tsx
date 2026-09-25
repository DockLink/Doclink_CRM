"use client";

import { useState, useRef, useEffect, type MouseEvent as ReactMouseEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { UserRole } from "@/lib/types";
import { LostReasonModal, type LostReason } from "@/components/LostReasonModal";
import { assigneeColor, displayDate, initials, type ApiLead, urgencyFor } from "@/lib/lead-ui";
import { activeStages, stageColor, type PipelineStage } from "@/lib/pipeline-stages";
import { usePipelineStages } from "@/lib/use-pipeline-stages";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Lead {
  id: string;
  stage: string;
  company: string;
  niche: string;
  contact: string;
  phone: string;
  priority: "hot" | "warm" | "cold";
  followUp: { date: string; urgency: "overdue" | "today" | "upcoming" | "none" };
  calls: number;
  assigneeInitials: string;
  assigneeColor: string;
  neverContacted?: boolean;
  lostReason?: LostReason;
}

type PendingLost = {
  leadId: string;
  company: string;
};

// ─── Palette ──────────────────────────────────────────────────────────────────

const PRIORITY_COLOR = { hot: "#EF4444", warm: "#F59E0B", cold: "#3B82F6" };

// ─── Initial lead data (includes stage field for lifted state) ─────────────────

const INITIAL_LEADS: Lead[] = [
  // New Lead
  { id: "nl1", stage: "New Lead", company: "Vertex Systems", niche: "SaaS", contact: "Angela Park", phone: "+1 555 201 4432", priority: "warm", followUp: { date: "Thu 15 Sep", urgency: "upcoming" }, calls: 0, assigneeInitials: "JC", assigneeColor: "#2FBEB3", neverContacted: true },
  { id: "nl2", stage: "New Lead", company: "Luminary Co.", niche: "Fintech", contact: "Ben Howell", phone: "+1 555 887 3310", priority: "cold", followUp: { date: "Fri 16 Sep", urgency: "upcoming" }, calls: 0, assigneeInitials: "MR", assigneeColor: "#F59E0B", neverContacted: true },
  // No Answer
  { id: "na1", stage: "No Answer", company: "Crestline Labs", niche: "Pharma", contact: "Priya Singh", phone: "+1 555 443 0091", priority: "hot", followUp: { date: "Today 14:00", urgency: "today" }, calls: 2, assigneeInitials: "AS", assigneeColor: "#6366F1" },
  { id: "na2", stage: "No Answer", company: "Orion Partners", niche: "Logistics", contact: "Julia Chen", phone: "+1 555 662 7712", priority: "warm", followUp: { date: "Yesterday 09:00", urgency: "overdue" }, calls: 1, assigneeInitials: "DK", assigneeColor: "#F97316" },
  // Try Again
  { id: "ta1", stage: "Try Again", company: "Atlas Holdings", niche: "Real Estate", contact: "Carlos Ruiz", phone: "+1 555 771 5543", priority: "warm", followUp: { date: "Today 11:30", urgency: "today" }, calls: 3, assigneeInitials: "NW", assigneeColor: "#16A34A" },
  // Conversation
  { id: "cv1", stage: "Conversation", company: "Meridian Corp", niche: "Enterprise SaaS", contact: "Sarah Blake", phone: "+1 555 340 9921", priority: "hot", followUp: { date: "Today 15:30", urgency: "today" }, calls: 5, assigneeInitials: "JC", assigneeColor: "#2FBEB3" },
  { id: "cv2", stage: "Conversation", company: "Pinnacle Health", niche: "Healthcare", contact: "Diane Yuen", phone: "+1 555 219 6644", priority: "warm", followUp: { date: "Yesterday 16:00", urgency: "overdue" }, calls: 3, assigneeInitials: "AS", assigneeColor: "#6366F1" },
  { id: "cv3", stage: "Conversation", company: "Solaris Group", niche: "Clean Energy", contact: "Emma Novak", phone: "+1 555 508 1177", priority: "hot", followUp: { date: "Thu 15 Sep", urgency: "upcoming" }, calls: 4, assigneeInitials: "MR", assigneeColor: "#F59E0B" },
  { id: "cv4", stage: "Conversation", company: "Redwood Capital", niche: "Investment", contact: "Marcus Webb", phone: "+1 555 430 8823", priority: "cold", followUp: { date: "Mon 18 Sep", urgency: "upcoming" }, calls: 2, assigneeInitials: "NW", assigneeColor: "#16A34A" },
  // Proposal Sent
  { id: "ps1", stage: "Proposal Sent", company: "Nexus Digital", niche: "Agency", contact: "Tom Brennan", phone: "+1 555 774 3300", priority: "hot", followUp: { date: "Yesterday 11:00", urgency: "overdue" }, calls: 6, assigneeInitials: "JC", assigneeColor: "#2FBEB3" },
  { id: "ps2", stage: "Proposal Sent", company: "Vanguard Tech", niche: "Deep Tech", contact: "Raj Patel", phone: "+1 555 991 2254", priority: "warm", followUp: { date: "Today 10:30", urgency: "today" }, calls: 4, assigneeInitials: "DK", assigneeColor: "#F97316" },
  // Meeting Booked
  { id: "mb1", stage: "Meeting Booked", company: "Summit Partners", niche: "Consulting", contact: "Keiko Tanaka", phone: "+1 555 663 4410", priority: "warm", followUp: { date: "Fri 16 Sep", urgency: "upcoming" }, calls: 5, assigneeInitials: "AS", assigneeColor: "#6366F1" },
  // Estimate Sent
  { id: "es1", stage: "Estimate Sent", company: "Ironbridge Group", niche: "Infrastructure", contact: "Paul Denton", phone: "+1 555 382 9901", priority: "hot", followUp: { date: "Today 16:00", urgency: "today" }, calls: 7, assigneeInitials: "JC", assigneeColor: "#2FBEB3" },
  { id: "es2", stage: "Estimate Sent", company: "Clearpath Media", niche: "Marketing", contact: "Sofia Reyes", phone: "+1 555 114 5530", priority: "warm", followUp: { date: "Wed 20 Sep", urgency: "upcoming" }, calls: 5, assigneeInitials: "NW", assigneeColor: "#16A34A" },
  // Closed Won
  { id: "cw1", stage: "Closed Won", company: "Apex Industries", niche: "Manufacturing", contact: "Derek Owens", phone: "+1 555 124 8870", priority: "warm", followUp: { date: "Mon 18 Sep", urgency: "upcoming" }, calls: 8, assigneeInitials: "NW", assigneeColor: "#16A34A" },
  // Closed Lost
  { id: "cl1", stage: "Closed Lost", company: "Crestview Corp", niche: "Retail", contact: "Liam O'Brien", phone: "+1 555 335 7720", priority: "cold", followUp: { date: "—", urgency: "none" }, calls: 3, assigneeInitials: "MR", assigneeColor: "#F59E0B" },
  // Dead Lead
  { id: "dl1", stage: "Dead Lead", company: "Ironclad Media", niche: "Media", contact: "Claire Fox", phone: "+1 555 990 1143", priority: "cold", followUp: { date: "—", urgency: "none" }, calls: 1, assigneeInitials: "DK", assigneeColor: "#F97316" },
];

// ─── Icons ────────────────────────────────────────────────────────────────────

function PriorityDot({ priority }: { priority: "hot" | "warm" | "cold" }) {
  return (
    <div
      className="w-2.5 h-2.5 rounded-full shrink-0"
      style={{ background: PRIORITY_COLOR[priority] }}
      aria-label={`${priority} priority`}
    />
  );
}

function KebabIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" style={{ color: "#9CA3AF" }}>
      <circle cx="12" cy="5" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="12" cy="19" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  );
}

function CalendarTinyIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1.27h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.91a16 16 0 0 0 6 6l.91-.92a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21.73 16.92z" />
    </svg>
  );
}

function CallIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: "#9CA3AF" }}>
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1.27h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.91a16 16 0 0 0 6 6l.91-.92a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21.73 16.92z" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "#9CA3AF" }}>
      <rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function ChevronDownTinyIcon({ open }: { open?: boolean }) {
  return (
    <svg
      width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
      style={{ color: open ? "#2FBEB3" : "#9CA3AF", transition: "transform 0.15s, color 0.1s", transform: open ? "rotate(180deg)" : "none" }}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function FilterIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: "#6B7280" }}>
      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
    </svg>
  );
}

function UploadIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function CheckTinyIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: "#2FBEB3" }}>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

// ─── Follow-up chip ────────────────────────────────────────────────────────────

function FollowUpChip({ date, urgency }: { date: string; urgency: Lead["followUp"]["urgency"] }) {
  if (urgency === "none") return null;

  const styles = {
    overdue:  { bg: "#FEF2F2", color: "#DC2626", border: "#FCA5A5" },
    today:    { bg: "#FEF3C7", color: "#B45309", border: "#FDE68A" },
    upcoming: { bg: "#F3F4F6", color: "#6B7280", border: "#E5E7EB" },
  }[urgency] ?? { bg: "#F3F4F6", color: "#6B7280", border: "#E5E7EB" };

  return (
    <div
      className="flex items-center gap-1 px-1.5 py-0.5 rounded"
      style={{ background: styles.bg, border: `1px solid ${styles.border}`, width: "fit-content" }}
    >
      <span style={{ color: styles.color }}><CalendarTinyIcon /></span>
      <span style={{ fontSize: 10, fontWeight: 500, color: styles.color, whiteSpace: "nowrap" }}>{date}</span>
    </div>
  );
}

// ─── Quick-stage selector dropdown ────────────────────────────────────────────

function StageSelector({
  currentStage,
  stages,
  onSelect,
}: {
  currentStage: string;
  stages: PipelineStage[];
  onSelect: (stage: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleSelect = (stage: string) => {
    onSelect(stage);
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative" style={{ zIndex: open ? 100 : "auto" }}>
      {/* Trigger */}
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        className="flex items-center gap-1 px-1.5 py-0.5 rounded transition-all"
        style={{
          background: open ? "#E3F7F5" : "#F3F4F6",
          border: `1px solid ${open ? "#2FBEB3" : "#E5E7EB"}`,
          cursor: "pointer",
          outline: "none",
        }}
        title="Change stage"
        aria-label="Change stage"
        aria-expanded={open}
      >
        <div className="w-2 h-2 rounded-full shrink-0" style={{ background: stageColor(stages, currentStage) }} />
        <span style={{ fontSize: 10, fontWeight: 500, color: open ? "#0E7A70" : "#6B7280", maxWidth: 72, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {currentStage}
        </span>
        <ChevronDownTinyIcon open={open} />
      </button>

      {/* Dropdown */}
      {open && (
        <div
          className="absolute rounded-lg shadow-xl"
          style={{
            bottom: "calc(100% + 4px)",
            left: 0,
            width: 192,
            background: "#FFFFFF",
            border: "1px solid #E5E7EB",
            zIndex: 200,
            overflow: "hidden",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-3 py-2" style={{ borderBottom: "1px solid #F3F4F6" }}>
            <span style={{ fontSize: 10, fontWeight: 600, color: "#9CA3AF", letterSpacing: "0.06em" }}>MOVE TO STAGE</span>
          </div>
          {activeStages(stages).map((stage) => {
            const isCurrent = stage.name === currentStage;
            return (
              <button
                key={stage.id}
                type="button"
                onClick={() => handleSelect(stage.name)}
                className="w-full flex items-center gap-2 px-3 text-left transition-colors"
                style={{
                  height: 34,
                  background: isCurrent ? "#E3F7F5" : "transparent",
                  border: "none",
                  cursor: isCurrent ? "default" : "pointer",
                  outline: "none",
                }}
                onMouseEnter={(e) => { if (!isCurrent) (e.currentTarget as HTMLButtonElement).style.background = "#F9FAFB"; }}
                onMouseLeave={(e) => { if (!isCurrent) (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
                disabled={isCurrent}
              >
                <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: stage.color }} />
                <span style={{ fontSize: 12, color: isCurrent ? "#0E7A70" : "#374151", fontWeight: isCurrent ? 600 : 400, flex: 1 }}>
                  {stage.name}
                </span>
                {isCurrent && <CheckTinyIcon />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Lead card ────────────────────────────────────────────────────────────────

function LeadCard({
  lead,
  stages,
  isPlaceholder = false,
  onStageChange,
}: {
  lead: Lead;
  stages: PipelineStage[];
  isPlaceholder?: boolean;
  onStageChange: (leadId: string, newStage: string) => void;
}) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);

  const handleCopy = (e: ReactMouseEvent) => {
    e.stopPropagation();
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  if (isPlaceholder) {
    return (
      <div
        className="rounded-lg"
        style={{ height: 112, border: "2px dashed #2FBEB3", background: "#E3F7F5", opacity: 0.6 }}
      />
    );
  }

  return (
    <div
      className="rounded-lg flex flex-col gap-2 cursor-pointer select-none"
      style={{
        background: "#FFFFFF",
        border: "1px solid #E5E7EB",
        padding: 12,
        boxShadow: "0 1px 2px rgba(17,17,17,0.05)",
        position: "relative",
      }}
      onClick={() => router.push(`/leads/${lead.id}`)}
      role="link"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter") router.push(`/leads/${lead.id}`); }}
    >
      {/* Row 1: priority + company + kebab */}
      <div className="flex items-start gap-1.5">
        <span className="mt-0.5 shrink-0"><PriorityDot priority={lead.priority} /></span>
        <span className="flex-1 min-w-0 font-semibold truncate" style={{ fontSize: 13, color: "#111111" }}>
          {lead.company}
        </span>
        <button
          className="shrink-0 hover:opacity-70 transition-opacity -mr-1 -mt-0.5"
          style={{ background: "none", border: "none", cursor: "pointer", padding: 2 }}
          onClick={(e) => e.stopPropagation()}
        >
          <KebabIcon />
        </button>
      </div>

      {/* Niche tag */}
      <span
        className="self-start px-1.5 py-0.5 rounded"
        style={{ fontSize: 10, fontWeight: 500, color: "#6B7280", background: "#F3F4F6", border: "1px solid #E5E7EB" }}
      >
        {lead.niche}
      </span>

      {/* Contact + phone */}
      <div className="flex flex-col gap-0.5">
        <span style={{ fontSize: 12, color: "#374151", fontWeight: 500 }}>{lead.contact}</span>
        <div className="flex items-center gap-1">
          <span style={{ color: "#9CA3AF" }}><PhoneIcon /></span>
          <span style={{ fontSize: 11, color: "#9CA3AF" }}>{lead.phone}</span>
          <button
            onClick={handleCopy}
            className="hover:opacity-70 transition-opacity"
            style={{ background: "none", border: "none", cursor: "pointer", padding: 0, marginLeft: 2 }}
            title="Copy phone"
          >
            {copied ? <span style={{ fontSize: 9, color: "#16A34A", fontWeight: 600 }}>✓</span> : <CopyIcon />}
          </button>
        </div>
      </div>

      {/* Follow-up chip */}
      <FollowUpChip date={lead.followUp.date} urgency={lead.followUp.urgency} />

      {/* Bottom row: stage selector | calls + assignee */}
      <div className="flex items-center justify-between gap-1">
        {/* Quick-stage selector */}
        <StageSelector
          currentStage={lead.stage}
          stages={stages}
          onSelect={(newStage) => onStageChange(lead.id, newStage)}
        />

        {/* Right side: calls + assignee */}
        <div className="flex items-center gap-1.5 shrink-0">
          {lead.neverContacted ? (
            <span
              className="px-1.5 py-0.5 rounded"
              style={{ fontSize: 10, fontWeight: 500, color: "#94A3B8", background: "#F8FAFC", border: "1px solid #CBD5E1" }}
            >
              Not contacted
            </span>
          ) : (
            <div className="flex items-center gap-0.5">
              <CallIcon />
              <span style={{ fontSize: 11, color: "#9CA3AF" }}>{lead.calls}</span>
            </div>
          )}
          <div
            className="w-6 h-6 rounded-full flex items-center justify-center text-white shrink-0"
            style={{ fontSize: 9, fontWeight: 700, background: lead.assigneeColor }}
            title={lead.assigneeInitials}
          >
            {lead.assigneeInitials}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Kanban column ─────────────────────────────────────────────────────────────

function KanbanColumn({
  stage,
  color,
  stages,
  leads,
  onStageChange,
}: {
  stage: string;
  color: string;
  stages: PipelineStage[];
  leads: Lead[];
  onStageChange: (leadId: string, newStage: string) => void;
}) {
  return (
    <div className="flex flex-col shrink-0" style={{ width: 272 }}>
      {/* Header */}
      <div
        className="rounded-lg mb-2"
        style={{
          background: "#FFFFFF",
          border: "1px solid #E5E7EB",
          borderTop: `3px solid ${color}`,
          padding: "10px 12px",
          boxShadow: "0 1px 2px rgba(17,17,17,0.04)",
        }}
      >
        <div className="flex items-center gap-2">
          <span style={{ fontSize: 13, fontWeight: 600, color: "#111111" }}>{stage}</span>
          <span
            className="px-1.5 py-0.5 rounded-full"
            style={{ fontSize: 10, fontWeight: 600, background: "#F3F4F6", color: "#6B7280" }}
          >
            {leads.length}
          </span>
        </div>
      </div>

      {/* Cards */}
      <div
        className="flex flex-col gap-2 flex-1 rounded-lg p-2"
        style={{ background: "#F8FAFB", border: "2px solid transparent", minHeight: 120 }}
      >
        {leads.map((lead) => (
          <LeadCard key={lead.id} lead={lead} stages={stages} onStageChange={onStageChange} />
        ))}
      </div>
    </div>
  );
}

// ─── Top controls ─────────────────────────────────────────────────────────────

function KanbanTopBar({ role }: { role: UserRole }) {
  return (
    <div
      className="flex items-center gap-3 px-6 shrink-0"
      style={{ height: 56, background: "#FFFFFF", borderBottom: "1px solid #E5E7EB" }}
    >
      {/* View toggle */}
      <div className="flex rounded-lg overflow-hidden shrink-0" style={{ border: "1px solid #E5E7EB" }}>
        {([
          { label: "Kanban", href: "/pipeline/kanban" },
          { label: "List", href: "/pipeline/list" },
        ] as const).map(({ label, href }) => {
          const active = label === "Kanban";
          return (
            <Link
              key={label}
              href={href}
              className="px-3 h-8 text-xs font-medium transition-all flex items-center"
              style={{ background: active ? "#2FBEB3" : "#FFFFFF", color: active ? "#FFFFFF" : "#6B7280", textDecoration: "none" }}
            >
              {label}
            </Link>
          );
        })}
      </div>

      <div className="flex-1" />

      <button
        type="button"
        className="flex items-center gap-1.5 px-3 h-9 rounded-lg text-sm font-medium transition-colors hover:bg-[#F9FAFB]"
        style={{ border: "1px solid #E5E7EB", background: "#FFFFFF", cursor: "pointer", color: "#374151" }}
      >
        <FilterIcon />
        Filter
      </button>

      {role === "superadmin" && (
        <Link
          href="/pipeline/bulk-import"
          className="flex items-center gap-1.5 px-3 h-9 rounded-lg text-sm font-medium transition-colors"
          style={{ border: "1px solid #0E7A70", background: "#FFFFFF", color: "#0E7A70", textDecoration: "none" }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "#E3F7F5"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "#FFFFFF"; }}
        >
          <UploadIcon />
          Import Leads
        </Link>
      )}

      <Link
        href="/leads/new"
        className="flex items-center gap-1.5 px-3 h-9 rounded-lg text-sm font-semibold text-white transition-all"
        style={{ background: "#2FBEB3", textDecoration: "none" }}
        onMouseEnter={(e) => { e.currentTarget.style.background = "#0E7A70"; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = "#2FBEB3"; }}
      >
        <PlusIcon />
        Add Lead
      </Link>
    </div>
  );
}

// ─── Kanban board (lifted state) ───────────────────────────────────────────────

export function Kanban({ role }: { role: UserRole }) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const { stages, loading: stagesLoading, error: stagesError } = usePipelineStages();
  const columns = activeStages(stages);
  const [pendingLost, setPendingLost] = useState<PendingLost | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadLeads = async () => {
      try {
        const response = await fetch("/api/leads");
        const result = await response.json() as { leads?: ApiLead[]; error?: string };
        if (!response.ok) {
          setError(result.error ?? "Unable to load leads.");
          return;
        }
        setLeads((result.leads ?? []).map((lead) => ({
          id: lead.id,
          stage: lead.stage,
          company: lead.company,
          niche: lead.niche,
          contact: lead.contact,
          phone: lead.phone,
          priority: lead.priority ?? "cold",
          followUp: { date: displayDate(lead.followUpDate), urgency: urgencyFor(lead.followUpDate) },
          calls: lead.calls,
          neverContacted: lead.calls === 0,
          assigneeInitials: initials(lead.assigneeName),
          assigneeColor: assigneeColor(lead.assigneeName),
        })));
      } catch {
        setError("Unable to reach the server. Please refresh and try again.");
      } finally {
        setLoading(false);
      }
    };
    void loadLeads();
  }, []);

  const applyStageChange = async (leadId: string, newStage: string, lostReason?: LostReason) => {
    const response = await fetch("/api/leads", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [leadId], stage: newStage, lostReason }),
    });
    if (!response.ok) {
      const result = await response.json().catch(() => ({})) as { error?: string };
      setError(result.error ?? "Unable to move this lead.");
      return;
    }
    setError("");
    setLeads((prev) =>
      prev.map((l) =>
        l.id === leadId
          ? {
              ...l,
              stage: newStage,
              ...(newStage === "Closed Lost" && lostReason ? { lostReason } : {}),
              ...(newStage !== "Closed Lost" ? { lostReason: undefined } : {}),
            }
          : l
      )
    );
  };

  const handleStageChange = (leadId: string, newStage: string) => {
    const lead = leads.find((l) => l.id === leadId);
    if (!lead) return;

    // Require a lost reason before committing Closed Lost
    if (newStage === "Closed Lost" && lead.stage !== "Closed Lost") {
      setPendingLost({ leadId, company: lead.company });
      return;
    }

    void applyStageChange(leadId, newStage);
  };

  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 64px)" }}>
      <KanbanTopBar role={role} />

      <div
        className="flex-1 overflow-x-auto overflow-y-auto"
        style={{ padding: "16px 20px", background: "#FAFAFA" }}
      >
        {(loading || stagesLoading) && <p style={{ padding: 24, color: "#6B7280", fontSize: 13 }}>Loading pipeline...</p>}
        {!loading && (error || stagesError) && <p style={{ padding: 24, color: "#DC2626", fontSize: 13 }}>{error || stagesError}</p>}
        <div className="flex gap-3" style={{ minWidth: "max-content", alignItems: "flex-start" }}>
          {columns.map((stage) => (
            <KanbanColumn
              key={stage.id}
              stage={stage.name}
              color={stage.color}
              stages={columns}
              leads={leads.filter((l) => l.stage === stage.name)}
              onStageChange={handleStageChange}
            />
          ))}
        </div>
      </div>

      {pendingLost && (
        <LostReasonModal
          companyName={pendingLost.company}
          onCancel={() => setPendingLost(null)}
          onConfirm={(reason) => {
            void applyStageChange(pendingLost.leadId, "Closed Lost", reason);
            setPendingLost(null);
          }}
        />
      )}
    </div>
  );
}
