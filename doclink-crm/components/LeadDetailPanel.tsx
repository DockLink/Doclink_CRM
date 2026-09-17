"use client";

import { useState, useRef, useEffect, type ReactNode } from "react";
import type { UserRole } from "@/lib/types";
import { LogCallModal, type LogCallForm } from "@/components/LogCallModal";
import { LostReasonModal, type LostReason } from "@/components/LostReasonModal";

// ─── Types ────────────────────────────────────────────────────────────────────

type Priority = "hot" | "warm" | "cold";
type Tab = "details" | "activity";

type CallOutcome =
  | "answered"
  | "no_answer"
  | "callback_requested"
  | "voicemail"
  | "proposal_discussed"
  | "meeting_set";

interface ActivityEntry {
  id: string;
  outcome: CallOutcome;
  notes: string;
  loggedBy: string;
  timestamp: string;
  relativeTime: string;
}

interface CustomField {
  id: string;
  label: string;
  type: "text" | "number" | "date" | "dropdown" | "toggle" | "link";
  value: string | boolean;
  options?: string[];
  dropdownColor?: string;
}

interface LeadDetail {
  id: string;
  company: string;
  niche: string;
  contact: string;
  phone: string;
  source: string;
  priority: Priority;
  stage: string;
  assignee: string;
  assigneeInitials: string;
  assigneeColor: string;
  proposalSent: boolean;
  proposalSentAt?: string;
  followUpDate: string;
  followUpTime: string;
  notes: string;
  customFields: CustomField[];
  lastContacted: { outcome: CallOutcome; relativeTime: string; note: string };
  activity: ActivityEntry[];
  lostReason?: LostReason;
}

// ─── Palette helpers ──────────────────────────────────────────────────────────

const STAGE_COLORS: Record<string, string> = {
  "New Lead":       "#94A3B8",
  "No Answer":      "#FB923C",
  "Try Again":      "#F97316",
  "Conversation":   "#38BDF8",
  "Proposal Sent":  "#6366F1",
  "Meeting Booked": "#F59E0B",
  "Estimate Sent":  "#0891B2",
  "Closed Won":     "#16A34A",
  "Closed Lost":    "#57534E",
  "Dead Lead":      "#DC2626",
};

const STAGE_ORDER = Object.keys(STAGE_COLORS);

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

const OUTCOME_META: Record<CallOutcome, { label: string; bg: string; color: string }> = {
  answered:           { label: "Answered",           bg: "#DCFCE7", color: "#16A34A" },
  no_answer:          { label: "No Answer",           bg: "#FEF3C7", color: "#B45309" },
  callback_requested: { label: "Callback Requested",  bg: "#EDE9FE", color: "#6366F1" },
  voicemail:          { label: "Voicemail Left",       bg: "#F1F5F9", color: "#64748B" },
  proposal_discussed: { label: "Proposal Discussed",  bg: "#EDE9FE", color: "#6366F1" },
  meeting_set:        { label: "Meeting Set",          bg: "#FEF9C3", color: "#B45309" },
};

const ASSIGNEES = [
  { name: "James Carter", initials: "JC", color: "#2FBEB3" },
  { name: "Aisha Santos", initials: "AS", color: "#6366F1" },
  { name: "Marco Rivera", initials: "MR", color: "#F59E0B" },
  { name: "Natalie Wong", initials: "NW", color: "#16A34A" },
  { name: "Derek Kim", initials: "DK", color: "#F97316" },
];

// ─── Mock lead data ───────────────────────────────────────────────────────────

const MOCK_LEAD: LeadDetail = {
  id: "lead-001",
  company: "Meridian Corp",
  niche: "Enterprise SaaS",
  contact: "Sarah Blake",
  phone: "+1 555 340 9921",
  source: "Referral",
  priority: "hot",
  stage: "Proposal Sent",
  assignee: "James Carter",
  assigneeInitials: "JC",
  assigneeColor: "#2FBEB3",
  proposalSent: true,
  proposalSentAt: "Sep 12, 2026 · 3:14 PM",
  followUpDate: "2026-09-15",
  followUpTime: "15:30",
  notes: "Sarah confirmed the budget is approved and the procurement team is involved. Push for a close this week — they have a competing offer from a smaller vendor. Emphasise onboarding speed and integration support.",
  customFields: [
    { id: "cf1", label: "Company Size",     type: "dropdown", value: "201–500",    options: ["1–10","11–50","51–200","201–500","500+"], dropdownColor: "#6366F1" },
    { id: "cf2", label: "Annual Revenue",   type: "number",   value: "4200000" },
    { id: "cf3", label: "Decision Date",    type: "date",     value: "2026-09-22" },
    { id: "cf4", label: "NDA Signed",       type: "toggle",   value: true },
    { id: "cf5", label: "Case Study Sent",  type: "toggle",   value: false },
    { id: "cf6", label: "LinkedIn Profile", type: "link",     value: "https://linkedin.com/in/sarah-blake" },
  ],
  lastContacted: {
    outcome: "proposal_discussed",
    relativeTime: "2 days ago",
    note: "Walked through the proposal, addressed pricing objections. She'll loop in their CTO.",
  },
  activity: [
    {
      id: "a1",
      outcome: "proposal_discussed",
      notes: "Walked through the proposal line-by-line. Sarah raised concerns about seat pricing — offered a volume discount. She will loop in CTO before Friday.",
      loggedBy: "James Carter",
      timestamp: "Sep 13, 2026 · 2:41 PM",
      relativeTime: "2 days ago",
    },
    {
      id: "a2",
      outcome: "answered",
      notes: "Confirmed budget approval of $42k. Decision team is Sarah + CTO + Procurement lead. Timeline: end of September.",
      loggedBy: "James Carter",
      timestamp: "Sep 10, 2026 · 11:05 AM",
      relativeTime: "5 days ago",
    },
    {
      id: "a3",
      outcome: "callback_requested",
      notes: "Sarah was in a meeting. Asked me to call back Thursday after 11am.",
      loggedBy: "James Carter",
      timestamp: "Sep 8, 2026 · 9:30 AM",
      relativeTime: "7 days ago",
    },
    {
      id: "a4",
      outcome: "no_answer",
      notes: "No answer — left a brief voicemail about the upcoming proposal.",
      loggedBy: "Aisha Santos",
      timestamp: "Sep 5, 2026 · 3:00 PM",
      relativeTime: "10 days ago",
    },
    {
      id: "a5",
      outcome: "answered",
      notes: "First conversation. Strong interest — they've been manually tracking leads in a spreadsheet. Booked a demo for the following week.",
      loggedBy: "Aisha Santos",
      timestamp: "Sep 2, 2026 · 10:15 AM",
      relativeTime: "13 days ago",
    },
  ],
};

// ─── Icons ────────────────────────────────────────────────────────────────────

function XIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  );
}

function ChevronRightIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
  );
}

function ChevronDownIcon({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="6 9 12 15 18 9"/></svg>
  );
}

function CopyIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
    </svg>
  );
}

function LinkIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
    </svg>
  );
}

function KebabIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="5" r="1" fill="currentColor"/><circle cx="12" cy="12" r="1" fill="currentColor"/><circle cx="12" cy="19" r="1" fill="currentColor"/>
    </svg>
  );
}

function PhoneIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1.17h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.74a16 16 0 0 0 6 6l.94-.94a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
    </svg>
  );
}

function CheckIcon({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  );
}

// ─── Stage Selector dropdown ──────────────────────────────────────────────────

function StageSelector({ stage, onChange }: { stage: string; onChange: (s: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const color = STAGE_COLORS[stage] ?? "#94A3B8";

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-full font-semibold"
        style={{ height: 28, paddingInline: 12, background: `${color}18`, color, fontSize: 12, border: `1.5px solid ${color}40` }}
      >
        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
        {stage}
        <ChevronDownIcon />
      </button>
      {open && (
        <div className="absolute left-0 z-50 rounded-lg overflow-hidden" style={{ top: "calc(100% + 6px)", minWidth: 180, background: "#FFFFFF", boxShadow: "0 4px 20px rgba(15,27,60,0.14)", border: "1px solid #E3E7EF" }}>
          {STAGE_ORDER.map((s) => {
            const c = STAGE_COLORS[s];
            const active = s === stage;
            return (
              <button
                key={s}
                onClick={() => { onChange(s); setOpen(false); }}
                className="w-full flex items-center gap-2.5 px-3 py-2.5"
                style={{ fontSize: 13, color: active ? c : "#374151", background: active ? `${c}12` : "transparent" }}
                onMouseEnter={(e) => { if (!active) (e.currentTarget as HTMLButtonElement).style.background = "#F9FAFB"; }}
                onMouseLeave={(e) => { if (!active) (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
              >
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: c }} />
                <span className="flex-1 text-left">{s}</span>
                {active && <span style={{ color: "#2FBEB3" }}><CheckIcon /></span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Kebab menu ───────────────────────────────────────────────────────────────

function HeaderKebab({
  role,
  onMarkDead,
  onReassign,
  onDelete,
}: {
  role: UserRole;
  onMarkDead: () => void;
  onReassign: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  const items = [
    { label: "Mark as Dead Lead", color: "#DC2626", always: true, action: onMarkDead },
    { label: "Reassign",          color: "#374151", always: false, action: onReassign },
    { label: "Delete Lead",       color: "#DC2626", always: false, action: onDelete },
  ];

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center justify-center rounded-lg"
        style={{ width: 34, height: 34, color: "#6B7280", background: open ? "#F3F4F6" : "transparent", border: "1px solid #E3E7EF" }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#F3F4F6"; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = open ? "#F3F4F6" : "transparent"; }}
      >
        <KebabIcon />
      </button>
      {open && (
        <div className="absolute right-0 z-50 rounded-lg overflow-hidden" style={{ top: "calc(100% + 6px)", minWidth: 188, background: "#FFFFFF", boxShadow: "0 4px 20px rgba(15,27,60,0.14)", border: "1px solid #E3E7EF" }}>
          {items.filter((i) => i.always || role === "superadmin").map((item) => (
            <button
              key={item.label}
              onClick={() => { setOpen(false); item.action(); }}
              className="w-full text-left px-4 py-2.5"
              style={{ fontSize: 13, fontWeight: item.color === "#DC2626" ? 600 : 400, color: item.color }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = item.color === "#DC2626" ? "#FFF8F8" : "#F9FAFB"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Details Tab ──────────────────────────────────────────────────────────────

function DetailsTab({ lead, role, onLeadChange, onMarkDead }: { lead: LeadDetail; role: UserRole; onLeadChange: (l: LeadDetail) => void; onMarkDead: () => void }) {
  const [notes, setNotes] = useState(lead.notes);
  const [autoSaved, setAutoSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showLogModal, setShowLogModal] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleNotesChange = (val: string) => {
    setNotes(val);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      setAutoSaved(true);
      setTimeout(() => setAutoSaved(false), 2000);
    }, 900);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(lead.phone).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleLogCallSave = (data: LogCallForm) => {
    if (!data.outcome) return;

    const entry: ActivityEntry = {
      id: `a-${Date.now()}`,
      outcome: data.outcome,
      notes: data.notes || "No additional notes.",
      loggedBy: "James Carter",
      timestamp: "Just now",
      relativeTime: "Just now",
    };

    onLeadChange({
      ...lead,
      activity: [entry, ...lead.activity],
      lastContacted: {
        outcome: data.outcome,
        relativeTime: "Just now",
        note: data.notes || "No additional notes.",
      },
      ...(data.followUpDate
        ? { followUpDate: data.followUpDate, followUpTime: data.followUpTime }
        : {}),
    });
  };

  const nextStage = STAGE_ORDER[STAGE_ORDER.indexOf(lead.stage) + 1];

  return (
    <div className="flex gap-5 p-5">
      {/* Left 60% */}
      <div className="flex flex-col gap-4" style={{ flex: "0 0 60%" }}>

        {/* Quick Actions */}
        <Card title="Quick Actions">
          <div className="flex flex-col gap-4">
            <button
              type="button"
              onClick={() => setShowLogModal(true)}
              className="w-full flex items-center justify-center gap-2 rounded-lg font-semibold"
              style={{ height: 40, background: "#2FBEB3", color: "#FFFFFF", fontSize: 13 }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#0E7A70"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#2FBEB3"; }}
            >
              <PhoneIcon size={13} />
              Log Call
            </button>

            {/* Proposal Sent toggle */}
            <div className="flex items-center justify-between">
              <div>
                <p style={{ fontSize: 13, fontWeight: 600, color: "#111111" }}>Proposal Sent</p>
                {lead.proposalSent && lead.proposalSentAt && (
                  <p style={{ fontSize: 11, color: "#6B7280", marginTop: 2 }}>Set {lead.proposalSentAt}</p>
                )}
              </div>
              <button
                onClick={() => onLeadChange({ ...lead, proposalSent: !lead.proposalSent, proposalSentAt: !lead.proposalSent ? "Just now" : undefined })}
                className="rounded-full flex items-center"
                style={{ width: 44, height: 24, background: lead.proposalSent ? "#2FBEB3" : "#D1D5DB", padding: "0 3px", transition: "background 150ms" }}
              >
                <span
                  className="rounded-full"
                  style={{ width: 18, height: 18, background: "#FFFFFF", transform: lead.proposalSent ? "translateX(20px)" : "translateX(0)", transition: "transform 150ms", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }}
                />
              </button>
            </div>

            {/* Follow-up date + time */}
            <div className="flex gap-3">
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: "#6B7280", display: "block", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.06em" }}>Follow-up Date</label>
                <input
                  type="date"
                  defaultValue={lead.followUpDate}
                  className="w-full rounded-lg px-3"
                  style={{ height: 36, border: "1.5px solid #E3E7EF", fontSize: 13, color: "#111111", outline: "none" }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = "#2FBEB3"; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = "#E3E7EF"; }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: "#6B7280", display: "block", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.06em" }}>Time</label>
                <input
                  type="time"
                  defaultValue={lead.followUpTime}
                  className="w-full rounded-lg px-3"
                  style={{ height: 36, border: "1.5px solid #E3E7EF", fontSize: 13, color: "#111111", outline: "none" }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = "#2FBEB3"; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = "#E3E7EF"; }}
                />
              </div>
            </div>

            {/* Priority segmented selector */}
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: "#6B7280", display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>Priority</label>
              <div className="flex rounded-lg overflow-hidden" style={{ border: "1.5px solid #E3E7EF" }}>
                {(["hot", "warm", "cold"] as Priority[]).map((p) => {
                  const active = lead.priority === p;
                  return (
                    <button
                      key={p}
                      onClick={() => onLeadChange({ ...lead, priority: p })}
                      className="flex-1 flex items-center justify-center gap-1.5 font-semibold"
                      style={{
                        height: 36,
                        fontSize: 12,
                        background: active ? `${PRIORITY_COLOR[p]}18` : "#FFFFFF",
                        color: active ? PRIORITY_COLOR[p] : "#9CA3AF",
                        borderRight: p !== "cold" ? "1px solid #E3E7EF" : undefined,
                        transition: "all 120ms",
                      }}
                    >
                      <span className="w-2 h-2 rounded-full" style={{ background: active ? PRIORITY_COLOR[p] : "#D1D5DB" }} />
                      {PRIORITY_LABEL[p]}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Mark as Dead Lead */}
            <button
              type="button"
              onClick={onMarkDead}
              className="w-full flex items-center justify-center rounded-lg font-semibold"
              style={{ height: 36, border: "1.5px solid #DC2626", color: "#DC2626", fontSize: 13, background: "transparent" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#FFF8F8"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
            >
              Mark as Dead Lead
            </button>
          </div>
        </Card>

        {/* Notes */}
        <Card title="Notes">
          <div className="relative">
            <textarea
              value={notes}
              onChange={(e) => handleNotesChange(e.target.value)}
              rows={6}
              className="w-full rounded-lg px-3 py-2.5 resize-none"
              style={{ border: "1.5px solid #E3E7EF", fontSize: 13, color: "#111111", lineHeight: 1.7, outline: "none" }}
              onFocus={(e) => { e.currentTarget.style.borderColor = "#2FBEB3"; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = "#E3E7EF"; }}
            />
            {autoSaved && (
              <span style={{ position: "absolute", bottom: 8, right: 10, fontSize: 11, color: "#9CA3AF" }}>Auto-saved</span>
            )}
          </div>
        </Card>

        {/* Custom Fields */}
        <Card title="Custom Fields">
          <div className="flex flex-col gap-3">
            {lead.customFields.map((cf) => (
              <div key={cf.id} className="flex items-center justify-between gap-3">
                <span style={{ fontSize: 12, color: "#6B7280", flexShrink: 0, width: 130 }}>{cf.label}</span>
                <CustomFieldValue field={cf} />
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Right 40% */}
      <div className="flex flex-col gap-4" style={{ flex: 1 }}>

        {/* Info card */}
        <Card title="Info">
          <div className="flex flex-col gap-3">
            <InfoRow label="Company" value={lead.company} />
            <InfoRow label="Niche" value={lead.niche} />
            <InfoRow label="Contact" value={lead.contact} />
            <div className="flex items-center justify-between">
              <span style={{ fontSize: 12, color: "#6B7280" }}>Phone</span>
              <div className="flex items-center gap-1.5">
                <span style={{ fontSize: 13, fontWeight: 500, color: "#111111" }}>{lead.phone}</span>
                <button
                  onClick={handleCopy}
                  className="flex items-center justify-center rounded"
                  style={{ width: 22, height: 22, color: copied ? "#2FBEB3" : "#9CA3AF", background: copied ? "#E3F7F5" : "transparent" }}
                  title="Copy phone"
                >
                  {copied ? <CheckIcon size={11} /> : <CopyIcon />}
                </button>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span style={{ fontSize: 12, color: "#6B7280" }}>Source</span>
              <span className="px-2.5 py-0.5 rounded-full" style={{ fontSize: 11, fontWeight: 600, background: "#E3F7F5", color: "#0E7A70" }}>{lead.source}</span>
            </div>
            <div className="flex items-center justify-between">
              <span style={{ fontSize: 12, color: "#6B7280" }}>Assignee</span>
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full flex items-center justify-center text-white font-bold" style={{ background: lead.assigneeColor, fontSize: 10 }}>{lead.assigneeInitials}</span>
                <span style={{ fontSize: 13, fontWeight: 500, color: "#111111" }}>{lead.assignee}</span>
              </div>
            </div>
          </div>
        </Card>

        {/* Last Contacted */}
        <Card title="Last Contacted">
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <OutcomeBadge outcome={lead.lastContacted.outcome} />
              <span style={{ fontSize: 11, color: "#9CA3AF" }}>{lead.lastContacted.relativeTime}</span>
            </div>
            <p style={{ fontSize: 13, color: "#374151", lineHeight: 1.6 }}>{lead.lastContacted.note}</p>
          </div>
        </Card>

        {/* Next Stage hint */}
        {nextStage && (
          <div
            className="flex items-center gap-2 rounded-lg px-4 py-3"
            style={{ background: "#F9FAFB", border: "1px solid #E3E7EF" }}
          >
            <span style={{ fontSize: 12, color: "#6B7280" }}>Next stage:</span>
            <span className="flex items-center gap-1.5 rounded-full px-2.5 py-0.5" style={{ background: `${STAGE_COLORS[nextStage]}18`, color: STAGE_COLORS[nextStage], fontSize: 12, fontWeight: 600 }}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: STAGE_COLORS[nextStage] }} />
              {nextStage}
            </span>
          </div>
        )}
      </div>

      {showLogModal && (
        <LogCallModal
          companyName={lead.company}
          onClose={() => setShowLogModal(false)}
          onSave={handleLogCallSave}
        />
      )}
    </div>
  );
}

// ─── Activity Tab ─────────────────────────────────────────────────────────────

function ActivityTab({ lead }: { lead: LeadDetail }) {
  return (
    <div className="flex flex-col" style={{ padding: "20px 20px 32px" }}>
      <div className="flex items-center justify-between mb-6">
        <p style={{ fontSize: 13, color: "#6B7280" }}>{lead.activity.length} logged calls</p>
      </div>

      {/* Timeline */}
      <div className="relative flex flex-col gap-0" style={{ paddingLeft: 28 }}>
        {/* Vertical connecting line */}
        <div
          className="absolute"
          style={{ left: 8, top: 10, bottom: 10, width: 1.5, background: "linear-gradient(to bottom, #E3E7EF 0%, #E3E7EF 100%)" }}
        />

        {lead.activity.map((entry, idx) => {
          const meta = OUTCOME_META[entry.outcome];
          return (
            <div key={entry.id} className="relative flex flex-col gap-1.5 pb-7">
              {/* Timeline dot */}
              <div
                className="absolute flex items-center justify-center rounded-full"
                style={{ left: -28, top: 2, width: 18, height: 18, background: meta.bg, border: `2px solid ${meta.color}50`, zIndex: 1 }}
              >
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: meta.color }} />
              </div>

              {/* Entry card */}
              <div
                className="rounded-lg p-4 flex flex-col gap-2"
                style={{ background: idx === 0 ? "#F9FAFB" : "#FFFFFF", border: "1px solid #E3E7EF" }}
              >
                <div className="flex items-center justify-between">
                  <OutcomeBadge outcome={entry.outcome} />
                  <span style={{ fontSize: 11, color: "#9CA3AF" }}>{entry.relativeTime}</span>
                </div>
                <p style={{ fontSize: 13, color: "#374151", lineHeight: 1.65 }}>{entry.notes}</p>
                <p style={{ fontSize: 11, color: "#9CA3AF" }}>Logged by {entry.loggedBy} · {entry.timestamp}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Shared sub-components ────────────────────────────────────────────────────

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-xl flex flex-col" style={{ background: "#FFFFFF", border: "1px solid #E3E7EF", overflow: "hidden" }}>
      <div className="px-4 py-3" style={{ borderBottom: "1px solid #F3F4F6" }}>
        <h3 style={{ fontSize: 12, fontWeight: 700, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.07em" }}>{title}</h3>
      </div>
      <div className="px-4 py-4">{children}</div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span style={{ fontSize: 12, color: "#6B7280" }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 500, color: "#111111" }}>{value}</span>
    </div>
  );
}

function OutcomeBadge({ outcome }: { outcome: CallOutcome }) {
  const m = OUTCOME_META[outcome];
  return (
    <span className="px-2.5 py-1 rounded-full text-xs font-semibold" style={{ background: m.bg, color: m.color }}>
      {m.label}
    </span>
  );
}

function CustomFieldValue({ field }: { field: CustomField }) {
  if (field.type === "toggle") {
    const on = field.value === true;
    return (
      <button
        className="rounded-full flex items-center"
        style={{ width: 36, height: 20, background: on ? "#2FBEB3" : "#D1D5DB", padding: "0 2px" }}
      >
        <span
          className="rounded-full"
          style={{ width: 16, height: 16, background: "#FFFFFF", transform: on ? "translateX(16px)" : "translateX(0)", transition: "transform 120ms", boxShadow: "0 1px 2px rgba(0,0,0,0.2)" }}
        />
      </button>
    );
  }
  if (field.type === "dropdown") {
    return (
      <span
        className="px-2.5 py-0.5 rounded-full text-xs font-semibold"
        style={{ background: `${field.dropdownColor ?? "#6366F1"}18`, color: field.dropdownColor ?? "#6366F1" }}
      >
        {String(field.value)}
      </span>
    );
  }
  if (field.type === "link") {
    return (
      <a
        href={String(field.value)}
        target="_blank"
        rel="noreferrer"
        className="flex items-center gap-1"
        style={{ fontSize: 13, color: "#2FBEB3", fontWeight: 500, textDecoration: "none" }}
      >
        <LinkIcon /> View
      </a>
    );
  }
  if (field.type === "number") {
    const num = Number(field.value);
    return <span style={{ fontSize: 13, fontWeight: 600, color: "#111111" }}>${num.toLocaleString()}</span>;
  }
  return <span style={{ fontSize: 13, fontWeight: 500, color: "#111111" }}>{String(field.value)}</span>;
}

function AssigneeModal({ currentAssignee, onCancel, onConfirm }: {
  currentAssignee: string;
  onCancel: () => void;
  onConfirm: (assignee: (typeof ASSIGNEES)[number]) => void;
}) {
  const [assigneeName, setAssigneeName] = useState(currentAssignee);

  return (
    <div className="fixed inset-0 z-70 flex items-center justify-center" style={{ background: "rgba(15,27,60,0.45)" }} onClick={onCancel} role="presentation">
      <div role="dialog" aria-modal="true" aria-labelledby="reassign-title" style={{ width: 400, background: "#FFFFFF", borderRadius: 12, boxShadow: "0 8px 48px rgba(15,27,60,0.18)", border: "1px solid #E3E7EF" }} onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: "1px solid #E3E7EF" }}>
          <h3 id="reassign-title" style={{ fontSize: 15, fontWeight: 700, color: "#111111" }}>Reassign Lead</h3>
          <button type="button" onClick={onCancel} className="flex items-center justify-center rounded-lg" style={{ width: 30, height: 30, background: "#F3F4F6", color: "#6B7280" }} aria-label="Cancel"><XIcon /></button>
        </div>
        <div className="px-6 py-5">
          <label className="flex flex-col gap-2" style={{ fontSize: 12, fontWeight: 700, color: "#374151" }}>
            Assign to
            <select value={assigneeName} onChange={(event) => setAssigneeName(event.target.value)} autoFocus className="h-10 rounded-lg px-3 outline-none" style={{ background: "#FFFFFF", color: "#111111", border: "1px solid #D1D5DB", fontSize: 13 }}>
              {ASSIGNEES.map((assignee) => <option key={assignee.name} value={assignee.name}>{assignee.name}</option>)}
            </select>
          </label>
        </div>
        <div className="flex items-center justify-end gap-3 px-6 py-4" style={{ borderTop: "1px solid #E3E7EF" }}>
          <button type="button" onClick={onCancel} className="rounded-lg font-semibold" style={{ height: 38, paddingInline: 18, fontSize: 13, color: "#374151", background: "#F3F4F6" }}>Cancel</button>
          <button type="button" onClick={() => onConfirm(ASSIGNEES.find((assignee) => assignee.name === assigneeName)!)} className="rounded-lg font-semibold" style={{ height: 38, paddingInline: 20, fontSize: 13, color: "#FFFFFF", background: "#0E7A70" }}>Reassign</button>
        </div>
      </div>
    </div>
  );
}

function DeleteLeadModal({ companyName, onCancel, onConfirm }: { companyName: string; onCancel: () => void; onConfirm: (reason: string) => void }) {
  const [reason, setReason] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const reasonError = submitted && !reason.trim();

  useEffect(() => {
    const handler = (event: KeyboardEvent) => { if (event.key === "Escape") onCancel(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onCancel]);

  const handleConfirm = () => {
    setSubmitted(true);
    if (reason.trim()) onConfirm(reason.trim());
  };

  return (
    <div className="fixed inset-0 z-70 flex items-center justify-center" style={{ background: "rgba(15,27,60,0.45)" }} onClick={onCancel} role="presentation">
      <div role="dialog" aria-modal="true" aria-labelledby="delete-lead-title" style={{ width: 440, background: "#FFFFFF", borderRadius: 12, boxShadow: "0 8px 48px rgba(15,27,60,0.18)", border: "1px solid #E3E7EF" }} onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: "1px solid #E3E7EF" }}>
          <div><h3 id="delete-lead-title" style={{ fontSize: 15, fontWeight: 700, color: "#111111" }}>Delete Lead</h3><p style={{ fontSize: 12, color: "#6B7280", marginTop: 4 }}>{companyName} will be removed from the current view.</p></div>
          <button type="button" onClick={onCancel} className="flex items-center justify-center rounded-lg" style={{ width: 30, height: 30, background: "#F3F4F6", color: "#6B7280" }} aria-label="Cancel"><XIcon /></button>
        </div>
        <div className="px-6 py-5">
          <label className="flex flex-col gap-2" style={{ fontSize: 12, fontWeight: 700, color: "#374151" }}>
            Reason for deletion <span style={{ color: "#DC2626" }}>*</span>
            <textarea value={reason} onChange={(event) => setReason(event.target.value)} autoFocus rows={4} placeholder="Enter a reason" className="rounded-lg px-3 py-2 outline-none resize-none" style={{ fontSize: 13, color: "#111111", border: `1px solid ${reasonError ? "#FCA5A5" : "#D1D5DB"}` }} />
          </label>
          {reasonError && <p style={{ marginTop: 6, fontSize: 12, color: "#DC2626" }}>A deletion reason is required.</p>}
        </div>
        <div className="flex items-center justify-end gap-3 px-6 py-4" style={{ borderTop: "1px solid #E3E7EF" }}>
          <button type="button" onClick={onCancel} className="rounded-lg font-semibold" style={{ height: 38, paddingInline: 18, fontSize: 13, color: "#374151", background: "#F3F4F6" }}>Cancel</button>
          <button type="button" onClick={handleConfirm} className="rounded-lg font-semibold" style={{ height: 38, paddingInline: 20, fontSize: 13, color: "#FFFFFF", background: "#DC2626" }}>Delete Lead</button>
        </div>
      </div>
    </div>
  );
}

// ─── Main panel ───────────────────────────────────────────────────────────────

interface LeadDetailPanelProps {
  role: UserRole;
  initialTab?: Tab;
  onClose?: () => void;
  onDelete?: (leadId: string, reason: string) => void;
}

export function LeadDetailPanel({ role, initialTab = "details", onClose, onDelete }: LeadDetailPanelProps) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [lead, setLead] = useState<LeadDetail>(MOCK_LEAD);
  const [pendingLost, setPendingLost] = useState(false);
  const [pendingReassign, setPendingReassign] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (pendingLost) {
          setPendingLost(false);
          return;
        }
        onClose?.();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose, pendingLost]);

  const applyStageChange = (newStage: string, lostReason?: LostReason) => {
    setLead((prev) => ({
      ...prev,
      stage: newStage,
      ...(newStage === "Closed Lost" && lostReason ? { lostReason } : {}),
      ...(newStage !== "Closed Lost" ? { lostReason: undefined } : {}),
    }));
  };

  const requestStageChange = (newStage: string) => {
    if (newStage === "Closed Lost" && lead.stage !== "Closed Lost") {
      setPendingLost(true);
      return;
    }
    applyStageChange(newStage);
  };

  const handleReassign = (assignee: (typeof ASSIGNEES)[number]) => {
    setLead((prev) => ({
      ...prev,
      assignee: assignee.name,
      assigneeInitials: assignee.initials,
      assigneeColor: assignee.color,
    }));
    setPendingReassign(false);
  };

  const handleDelete = (reason: string) => {
    onDelete?.(lead.id, reason);
    setPendingDelete(false);
    onClose?.();
  };

  const nextStageIndex = STAGE_ORDER.indexOf(lead.stage) + 1;
  const nextStage = STAGE_ORDER[nextStageIndex];

  return (
    <>
      {/* Backdrop */}
      {onClose && (
        <div
          className="fixed inset-0 z-40"
          style={{ background: "rgba(15,27,60,0.4)" }}
          onClick={onClose}
        />
      )}

      {/* Panel */}
      <div
        className="fixed top-0 right-0 h-full z-50 flex flex-col"
        style={{ width: 720, background: "#FFFFFF", boxShadow: "-8px 0 40px rgba(15,27,60,0.14)" }}
      >
        {/* ── Sticky header */}
        <div
          className="shrink-0 flex flex-col"
          style={{ background: "#FFFFFF", borderBottom: "1px solid #E3E7EF", position: "sticky", top: 0, zIndex: 10 }}
        >
          {/* Top row */}
          <div className="flex items-center gap-3 px-5 py-4">
            {/* Close */}
            {onClose && (
              <button
                onClick={onClose}
                className="flex items-center justify-center rounded-lg shrink-0"
                style={{ width: 32, height: 32, color: "#6B7280", background: "#F3F4F6" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#E5E7EB"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#F3F4F6"; }}
              >
                <XIcon size={14} />
              </button>
            )}

            {/* Company + priority */}
            <div className="flex items-center gap-2.5 flex-1 min-w-0">
              <h2 style={{ fontSize: 18, fontWeight: 700, color: "#111111", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{lead.company}</h2>
              <div className="flex items-center gap-1 shrink-0">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: PRIORITY_COLOR[lead.priority] }} />
                <span style={{ fontSize: 12, fontWeight: 600, color: PRIORITY_COLOR[lead.priority] }}>{PRIORITY_LABEL[lead.priority]}</span>
              </div>
            </div>

            {/* Stage selector + Next Stage */}
            <div className="flex items-center gap-2 shrink-0">
              <StageSelector stage={lead.stage} onChange={requestStageChange} />
              {nextStage && (
                <button
                  className="flex items-center gap-1.5 rounded-lg font-semibold"
                  style={{ height: 28, paddingInline: 12, fontSize: 12, color: "#0E7A70", background: "#E3F7F5", border: "1.5px solid #A7F3D0" }}
                  onClick={() => requestStageChange(nextStage)}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#CCFBF1"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#E3F7F5"; }}
                >
                  Next Stage <ChevronRightIcon size={12} />
                </button>
              )}
              <HeaderKebab
                role={role}
                onMarkDead={() => requestStageChange("Dead Lead")}
                onReassign={() => setPendingReassign(true)}
                onDelete={() => setPendingDelete(true)}
              />
            </div>
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-0 px-5">
            {(["details", "activity"] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className="capitalize font-semibold pb-3 mr-6"
                style={{
                  fontSize: 14,
                  color: tab === t ? "#2FBEB3" : "#6B7280",
                  borderBottom: tab === t ? "2px solid #2FBEB3" : "2px solid transparent",
                  transition: "color 120ms, border-color 120ms",
                  background: "transparent",
                }}
              >
                {t === "details" ? "Details" : "Activity"}
              </button>
            ))}
          </div>
        </div>

        {/* ── Scrollable body */}
        <div className="flex-1 overflow-y-auto" style={{ background: "#F9FAFB" }}>
          {tab === "details" && <DetailsTab lead={lead} role={role} onLeadChange={setLead} onMarkDead={() => requestStageChange("Dead Lead")} />}
          {tab === "activity" && <ActivityTab lead={lead} />}
        </div>
      </div>

      {pendingLost && (
        <LostReasonModal
          companyName={lead.company}
          onCancel={() => setPendingLost(false)}
          onConfirm={(reason) => {
            applyStageChange("Closed Lost", reason);
            setPendingLost(false);
          }}
        />
      )}

      {pendingReassign && (
        <AssigneeModal
          currentAssignee={lead.assignee}
          onCancel={() => setPendingReassign(false)}
          onConfirm={handleReassign}
        />
      )}

      {pendingDelete && (
        <DeleteLeadModal
          companyName={lead.company}
          onCancel={() => setPendingDelete(false)}
          onConfirm={handleDelete}
        />
      )}
    </>
  );
}

export default LeadDetailPanel;
