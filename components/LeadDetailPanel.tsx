"use client";

import { useState, useRef, useEffect, useMemo, type CSSProperties, type ReactNode } from "react";
import type { UserRole } from "@/lib/types";
import {
  REVENUE_CURRENCIES,
  YES_NO_OPTIONS,
  formatMonthlyRevenue,
  parseMonthlyRevenue,
  type RevenueCurrency,
  type StandardFieldKey,
} from "@/lib/lead-custom-fields";
import { assigneeColor, initials, priorityForStage } from "@/lib/lead-ui";
import { nextStageName, stageColor, type PipelineStage } from "@/lib/pipeline-stages";
import { usePipelineStages } from "@/lib/use-pipeline-stages";
import { clearDraft, readDraft, useFormDraft } from "@/lib/use-form-draft";
import { LogCallModal, type LogCallForm } from "@/components/LogCallModal";
import { LostReasonModal, type LostReason } from "@/components/LostReasonModal";
import { CLOSED_LOST_OUTCOME } from "@/lib/lost-reasons";

// ─── Types ────────────────────────────────────────────────────────────────────

type Priority = "hot" | "warm" | "cold";
type Tab = "details" | "activity";

type CallOutcome =
  | "answered"
  | "no_answer"
  | "callback_requested"
  | "proposal_discussed"
  | "meeting_set"
  | typeof CLOSED_LOST_OUTCOME;

interface ActivityEntry {
  id: string;
  outcome: string;
  notes: string;
  loggedBy: string;
  timestamp: string;
  relativeTime: string;
}

interface CustomField {
  id: string;
  key?: StandardFieldKey;
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
  lastContacted: { outcome: string; relativeTime: string; note: string } | null;
  activity: ActivityEntry[];
  lostReason?: LostReason;
}

type LeadUpdate = LeadDetail | ((prev: LeadDetail) => LeadDetail);

interface LeadPatchResult {
  proposalSentDate?: string | null;
  customFields?: { id: string; value: string }[];
  error?: string;
}

async function patchLead(leadId: string, body: Record<string, unknown>) {
  const response = await fetch(`/api/leads/${leadId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const result = await response.json().catch(() => ({})) as LeadPatchResult;
  if (!response.ok) throw new Error(result.error ?? "Unable to save changes.");
  return result;
}

const leadDraftKey = (leadId: string, section: string) => `lead:${leadId}:${section}`;

const DEFAULT_SOURCES = ["Referral", "Website", "Cold Call", "LinkedIn", "Trade Show", "Email Campaign", "Partner", "Event"];

// ─── Palette helpers ──────────────────────────────────────────────────────────

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
  proposal_discussed: { label: "Proposal Discussed",  bg: "#EDE9FE", color: "#6366F1" },
  meeting_set:        { label: "Meeting Set",          bg: "#FEF9C3", color: "#B45309" },
  closed_lost:        { label: "Closed Lost",          bg: "#FEE2E2", color: "#B91C1C" },
};

const ASSIGNEES = [
  { name: "James Carter", initials: "JC", color: "#2FBEB3" },
  { name: "Aisha Santos", initials: "AS", color: "#6366F1" },
  { name: "Marco Rivera", initials: "MR", color: "#F59E0B" },
  { name: "Natalie Wong", initials: "NW", color: "#16A34A" },
  { name: "Derek Kim", initials: "DK", color: "#F97316" },
];

interface ApiLeadDetail {
  id: string;
  company: string;
  niche: string;
  contact: string;
  phone: string;
  source: string;
  priority: Priority;
  stage: string;
  assigneeName: string;
  proposalSent: boolean;
  proposalSentDate: string | null;
  followUpDate: string;
  followUpTime: string;
  notes: string;
  lostReason: string | null;
  customFields: CustomField[];
  activities: { id: string; outcome: string; notes: string; loggedBy: string; createdAt: string }[];
}

function relativeTime(iso: string) {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

function timestampLabel(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function toActivityEntry(entry: ApiLeadDetail["activities"][number]): ActivityEntry {
  return {
    id: entry.id,
    outcome: entry.outcome,
    notes: entry.notes || "No additional notes.",
    loggedBy: entry.loggedBy,
    timestamp: timestampLabel(entry.createdAt),
    relativeTime: relativeTime(entry.createdAt),
  };
}

function toLeadDetail(lead: ApiLeadDetail): LeadDetail {
  const activity = lead.activities.map(toActivityEntry);
  const latest = activity[0];
  return {
    id: lead.id,
    company: lead.company,
    niche: lead.niche,
    contact: lead.contact,
    phone: lead.phone,
    source: lead.source,
    priority: lead.priority,
    stage: lead.stage,
    assignee: lead.assigneeName,
    assigneeInitials: initials(lead.assigneeName),
    assigneeColor: assigneeColor(lead.assigneeName),
    proposalSent: lead.proposalSent,
    proposalSentAt: lead.proposalSentDate ? timestampLabel(lead.proposalSentDate) : undefined,
    followUpDate: lead.followUpDate,
    followUpTime: lead.followUpTime,
    notes: lead.notes,
    customFields: lead.customFields,
    lastContacted: latest
      ? { outcome: latest.outcome, relativeTime: latest.relativeTime, note: latest.notes }
      : null,
    activity,
    lostReason: lead.lostReason ?? undefined,
  };
}

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

function PencilIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
    </svg>
  );
}

// ─── Stage Selector dropdown ──────────────────────────────────────────────────

function StageSelector({ stage, stages, onChange }: { stage: string; stages: PipelineStage[]; onChange: (s: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const color = stageColor(stages, stage);

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
          {stages.filter((item) => item.active).map((item) => {
            const c = item.color;
            const active = item.name === stage;
            return (
              <button
                key={item.id}
                onClick={() => { onChange(item.name); setOpen(false); }}
                className="w-full flex items-center gap-2.5 px-3 py-2.5"
                style={{ fontSize: 13, color: active ? c : "#374151", background: active ? `${c}12` : "transparent" }}
                onMouseEnter={(e) => { if (!active) (e.currentTarget as HTMLButtonElement).style.background = "#F9FAFB"; }}
                onMouseLeave={(e) => { if (!active) (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
              >
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: c }} />
                <span className="flex-1 text-left">{item.name}</span>
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

function DetailsTab({ lead, role, stages, onLeadChange, onMarkDead }: { lead: LeadDetail; role: UserRole; stages: PipelineStage[]; onLeadChange: (update: LeadUpdate) => void; onMarkDead: () => void }) {
  const notesDraftKey = leadDraftKey(lead.id, "notes");
  const [notes, setNotes] = useState(() => readDraft<string>(notesDraftKey) ?? lead.notes);
  useFormDraft(notesDraftKey, notes, { isEmpty: (value) => value === lead.notes });
  const [notesStatus, setNotesStatus] = useState<"idle" | "saved" | "error">("idle");
  const latestNotes = useRef(notes);
  const [showLogModal, setShowLogModal] = useState(false);
  const [customFieldError, setCustomFieldError] = useState("");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setCustomFieldValue = (fieldId: string, value: string | boolean) => {
    onLeadChange((prev) => ({
      ...prev,
      customFields: prev.customFields.map((cf) => (cf.id === fieldId ? { ...cf, value } : cf)),
    }));
  };

  const saveCustomField = async (field: CustomField, value: string | boolean) => {
    const previous = field.value;
    setCustomFieldError("");
    setCustomFieldValue(field.id, value);
    try {
      const result = await patchLead(lead.id, { customFields: [{ id: field.id, value }] });
      clearDraft(leadDraftKey(lead.id, `field:${field.id}`));
      const saved = result.customFields?.find((entry) => entry.id === field.id)?.value;
      if (saved !== undefined) setCustomFieldValue(field.id, field.type === "toggle" ? saved === "true" : saved);
    } catch (err) {
      setCustomFieldValue(field.id, previous);
      setCustomFieldError(err instanceof Error ? err.message : "Unable to save changes.");
    }
  };

  const toggleProposalSent = async () => {
    const next = !lead.proposalSent;
    const previousAt = lead.proposalSentAt;
    setCustomFieldError("");
    onLeadChange((prev) => ({ ...prev, proposalSent: next, proposalSentAt: next ? "Just now" : undefined }));
    try {
      const result = await patchLead(lead.id, { proposalSent: next });
      onLeadChange((prev) => ({
        ...prev,
        proposalSentAt: result.proposalSentDate ? timestampLabel(result.proposalSentDate) : undefined,
      }));
    } catch (err) {
      onLeadChange((prev) => ({ ...prev, proposalSent: !next, proposalSentAt: previousAt }));
      setCustomFieldError(err instanceof Error ? err.message : "Unable to save changes.");
    }
  };

  const saveNotes = async (value: string) => {
    try {
      await patchLead(lead.id, { notes: value });
      onLeadChange((prev) => ({ ...prev, notes: value }));
      if (latestNotes.current !== value) return;
      clearDraft(notesDraftKey);
      setNotesStatus("saved");
      setTimeout(() => setNotesStatus((status) => (status === "saved" ? "idle" : status)), 2000);
    } catch {
      if (latestNotes.current === value) setNotesStatus("error");
    }
  };

  const handleNotesChange = (val: string) => {
    setNotes(val);
    latestNotes.current = val;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => void saveNotes(val), 900);
  };

  useEffect(() => {
    if (latestNotes.current !== lead.notes) void saveNotes(latestNotes.current);
    // Only on mount: syncs notes restored from a draft that never reached the server.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (notesStatus !== "error") return;
    const retry = () => void saveNotes(latestNotes.current);
    window.addEventListener("online", retry);
    return () => window.removeEventListener("online", retry);
  });

  const handleLogCallSave = async (data: LogCallForm) => {
    if (!data.outcome) return;
    const response = await fetch("/api/activities", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        leadId: lead.id,
        outcome: data.outcome,
        notes: data.notes,
        followUpDate: data.followUpDate || undefined,
        followUpTime: data.followUpTime || undefined,
      }),
    });
    const result = await response.json().catch(() => ({})) as {
      id?: string;
      loggedBy?: string;
      error?: string;
    };
    if (!response.ok || !result.id) throw new Error(result.error ?? "Unable to save this call.");

    const entry: ActivityEntry = {
      id: result.id,
      outcome: data.outcome,
      notes: data.notes || "No additional notes.",
      loggedBy: result.loggedBy || "You",
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

  const nextStage = nextStageName(stages, lead.stage);
  const showLegacyLostReason = lead.stage === "Closed Lost"
    && Boolean(lead.lostReason)
    && lead.lastContacted?.outcome !== CLOSED_LOST_OUTCOME;

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
            {notesStatus === "saved" && (
              <span style={{ position: "absolute", bottom: 8, right: 10, fontSize: 11, color: "#9CA3AF" }}>Auto-saved</span>
            )}
            {notesStatus === "error" && (
              <span role="alert" style={{ position: "absolute", bottom: 8, right: 10, fontSize: 11, color: "#DC2626" }}>Not saved — kept as draft</span>
            )}
          </div>
        </Card>

        {/* Custom Fields */}
        <Card title="Custom Fields">
          <div className="flex flex-col gap-3">
            {lead.customFields.filter((cf) => cf.key).map((cf) => (
              <CustomFieldRow key={cf.id} label={cf.label}>
                <CustomFieldEditor field={cf} draftKey={leadDraftKey(lead.id, `field:${cf.id}`)} onSave={(value) => void saveCustomField(cf, value)} />
              </CustomFieldRow>
            ))}
            <CustomFieldRow
              label="Proposal Sent"
              hint={lead.proposalSent && lead.proposalSentAt ? `Set ${lead.proposalSentAt}` : undefined}
            >
              <Toggle on={lead.proposalSent} onClick={() => void toggleProposalSent()} label="Proposal Sent" />
            </CustomFieldRow>
            {lead.customFields.filter((cf) => !cf.key).map((cf) => (
              <CustomFieldRow key={cf.id} label={cf.label}>
                <CustomFieldEditor field={cf} draftKey={leadDraftKey(lead.id, `field:${cf.id}`)} onSave={(value) => void saveCustomField(cf, value)} />
              </CustomFieldRow>
            ))}
            {customFieldError && <p role="alert" style={{ fontSize: 12, color: "#DC2626" }}>{customFieldError}</p>}
          </div>
        </Card>
      </div>

      {/* Right 40% */}
      <div className="flex flex-col gap-4" style={{ flex: 1 }}>

        <InfoCard lead={lead} role={role} onLeadChange={onLeadChange} />

        {/* Last Contacted */}
        <Card title="Last Contacted">
          <div className="flex flex-col gap-3">
            {showLegacyLostReason && (
              <div className="flex flex-col gap-2">
                <span
                  className="self-start px-2.5 py-1 rounded-full text-xs font-semibold"
                  style={{ background: "#FEE2E2", color: "#B91C1C" }}
                >
                  Closed Lost
                </span>
                <p style={{ fontSize: 13, color: "#374151", lineHeight: 1.6 }}>{lead.lostReason}</p>
              </div>
            )}
            {lead.lastContacted ? (
              <div
                className="flex flex-col gap-2.5"
                style={showLegacyLostReason ? { paddingTop: 12, borderTop: "1px solid #F3F4F6" } : undefined}
              >
                <div className="flex items-center justify-between">
                  <OutcomeBadge outcome={lead.lastContacted.outcome} />
                  <span style={{ fontSize: 11, color: "#9CA3AF" }}>{lead.lastContacted.relativeTime}</span>
                </div>
                <p style={{ fontSize: 13, color: "#374151", lineHeight: 1.6 }}>{lead.lastContacted.note}</p>
              </div>
            ) : !showLegacyLostReason ? (
              <p style={{ fontSize: 13, color: "#9CA3AF" }}>No calls logged yet.</p>
            ) : null}
          </div>
        </Card>

        {/* Next Stage hint */}
        {nextStage && (
          <div
            className="flex items-center gap-2 rounded-lg px-4 py-3"
            style={{ background: "#F9FAFB", border: "1px solid #E3E7EF" }}
          >
            <span style={{ fontSize: 12, color: "#6B7280" }}>Next stage:</span>
            <span className="flex items-center gap-1.5 rounded-full px-2.5 py-0.5" style={{ background: `${stageColor(stages, nextStage)}18`, color: stageColor(stages, nextStage), fontSize: 12, fontWeight: 600 }}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: stageColor(stages, nextStage) }} />
              {nextStage}
            </span>
          </div>
        )}
      </div>

      {showLogModal && (
        <LogCallModal
          leadId={lead.id}
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
  if (lead.activity.length === 0) {
    return (
      <div style={{ padding: "20px 20px 32px" }}>
        <p style={{ fontSize: 13, color: "#9CA3AF" }}>No calls logged yet.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col" style={{ padding: "20px 20px 32px" }}>
      <div className="flex items-center justify-between mb-6">
        <p style={{ fontSize: 13, color: "#6B7280" }}>
          {lead.activity.filter((entry) => entry.outcome !== CLOSED_LOST_OUTCOME).length} logged calls
        </p>
      </div>

      {/* Timeline */}
      <div className="relative flex flex-col gap-0" style={{ paddingLeft: 28 }}>
        {/* Vertical connecting line */}
        <div
          className="absolute"
          style={{ left: 8, top: 10, bottom: 10, width: 1.5, background: "linear-gradient(to bottom, #E3E7EF 0%, #E3E7EF 100%)" }}
        />

        {lead.activity.map((entry, idx) => {
          const meta = OUTCOME_META[entry.outcome as CallOutcome] ?? { label: entry.outcome, bg: "#F1F5F9", color: "#64748B" };
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

function Card({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <div className="rounded-xl flex flex-col" style={{ background: "#FFFFFF", border: "1px solid #E3E7EF", overflow: "hidden" }}>
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid #F3F4F6" }}>
        <h3 style={{ fontSize: 12, fontWeight: 700, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.07em" }}>{title}</h3>
        {action}
      </div>
      <div className="px-4 py-4">{children}</div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span style={{ fontSize: 12, color: "#6B7280" }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 500, color: value ? "#111111" : "#9CA3AF" }}>{value || "—"}</span>
    </div>
  );
}

function OutcomeBadge({ outcome }: { outcome: string }) {
  const m = OUTCOME_META[outcome as CallOutcome] ?? { label: outcome, bg: "#F1F5F9", color: "#64748B" };
  return (
    <span className="px-2.5 py-1 rounded-full text-xs font-semibold" style={{ background: m.bg, color: m.color }}>
      {m.label}
    </span>
  );
}

const FIELD_INPUT_STYLE: CSSProperties = {
  height: 32,
  width: "100%",
  minWidth: 0,
  border: "1.5px solid #E3E7EF",
  borderRadius: 8,
  padding: "0 10px",
  fontSize: 13,
  color: "#111111",
  background: "#FFFFFF",
  outline: "none",
};

const focusBorder = {
  onFocus: (e: { currentTarget: HTMLElement }) => { e.currentTarget.style.borderColor = "#2FBEB3"; },
  onBlur: (e: { currentTarget: HTMLElement }) => { e.currentTarget.style.borderColor = "#E3E7EF"; },
};

function Toggle({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onClick}
      className="rounded-full flex items-center shrink-0"
      style={{ width: 36, height: 20, background: on ? "#2FBEB3" : "#D1D5DB", padding: "0 2px", transition: "background 150ms" }}
    >
      <span
        className="rounded-full"
        style={{ width: 16, height: 16, background: "#FFFFFF", transform: on ? "translateX(16px)" : "translateX(0)", transition: "transform 120ms", boxShadow: "0 1px 2px rgba(0,0,0,0.2)" }}
      />
    </button>
  );
}

function Segmented({ options, value, onChange, colors }: {
  options: readonly string[];
  value: string;
  onChange: (option: string) => void;
  colors?: Record<string, string>;
}) {
  return (
    <div className="flex rounded-lg overflow-hidden shrink-0" style={{ border: "1.5px solid #E3E7EF", height: 32 }}>
      {options.map((option, i) => {
        const active = value === option;
        const color = colors?.[option] ?? "#0E7A70";
        return (
          <button
            key={option}
            type="button"
            onClick={() => onChange(option)}
            className="font-semibold"
            style={{
              minWidth: 44,
              paddingInline: 10,
              fontSize: 12,
              background: active ? `${color}18` : "#FFFFFF",
              color: active ? color : "#9CA3AF",
              borderRight: i < options.length - 1 ? "1px solid #E3E7EF" : undefined,
              transition: "all 120ms",
            }}
          >
            {option}
          </button>
        );
      })}
    </div>
  );
}

function CustomFieldRow({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div style={{ flexShrink: 0, width: 130 }}>
        <span style={{ fontSize: 12, color: "#6B7280" }}>{label}</span>
        {hint && <p style={{ fontSize: 11, color: "#9CA3AF", marginTop: 2 }}>{hint}</p>}
      </div>
      <div className="flex flex-1 justify-end min-w-0">{children}</div>
    </div>
  );
}

// Parents remount this with `key={value}` so the draft resets after a save.
function DraftInput({ value, type, placeholder, draftKey, onSave }: { value: string; type: string; placeholder?: string; draftKey: string; onSave: (value: string) => void }) {
  const [draft, setDraft] = useState(() => readDraft<string>(draftKey) ?? value);
  useFormDraft(draftKey, draft, { isEmpty: (next) => next.trim() === value });
  return (
    <input
      type={type}
      value={draft}
      placeholder={placeholder}
      onChange={(e) => setDraft(e.target.value)}
      onFocus={focusBorder.onFocus}
      onBlur={(e) => {
        focusBorder.onBlur(e);
        const next = draft.trim();
        if (next !== value) onSave(next);
      }}
      onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
      style={FIELD_INPUT_STYLE}
    />
  );
}

function MonthlyRevenueInput({ value, draftKey, onSave }: { value: string; draftKey: string; onSave: (value: string) => void }) {
  const [initial] = useState(() => ({ ...parseMonthlyRevenue(value), ...readDraft<{ currency: RevenueCurrency; amount: string }>(draftKey) }));
  const [currency, setCurrency] = useState<RevenueCurrency>(initial.currency);
  const [amount, setAmount] = useState(initial.amount);
  const [focused, setFocused] = useState(false);
  const revenueDraft = useMemo(() => ({ currency, amount }), [currency, amount]);
  useFormDraft(draftKey, revenueDraft, { isEmpty: (next) => formatMonthlyRevenue(next) === value });

  const commit = (nextCurrency: RevenueCurrency, nextAmount: string) => {
    const next = formatMonthlyRevenue({ currency: nextCurrency, amount: nextAmount });
    if (next !== value) onSave(next);
  };

  const shown = focused || !amount || Number.isNaN(Number(amount))
    ? amount
    : Number(amount).toLocaleString(currency === "Rs" ? "en-IN" : "en-US");

  return (
    <div className="flex items-center gap-2 w-full">
      <Segmented
        options={REVENUE_CURRENCIES}
        value={currency}
        onChange={(option) => {
          const next = option as RevenueCurrency;
          setCurrency(next);
          commit(next, amount);
        }}
      />
      <input
        inputMode="decimal"
        value={shown}
        placeholder="Amount"
        onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
        onFocus={(e) => { setFocused(true); focusBorder.onFocus(e); }}
        onBlur={(e) => { setFocused(false); focusBorder.onBlur(e); commit(currency, amount); }}
        onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
        style={{ ...FIELD_INPUT_STYLE, flex: 1 }}
      />
    </div>
  );
}

function CustomFieldEditor({ field, draftKey, onSave }: { field: CustomField; draftKey: string; onSave: (value: string | boolean) => void }) {
  const stored = typeof field.value === "boolean" ? String(field.value) : field.value ?? "";

  if (field.key === "monthlyRevenue") {
    return <MonthlyRevenueInput key={stored} value={stored} draftKey={draftKey} onSave={onSave} />;
  }
  if (field.key === "discoveryCall") {
    return (
      <Segmented
        options={YES_NO_OPTIONS}
        value={stored}
        colors={{ Yes: "#16A34A", No: "#DC2626" }}
        onChange={(option) => onSave(option === stored ? "" : option)}
      />
    );
  }
  if (field.type === "toggle") {
    return <Toggle on={field.value === true} onClick={() => onSave(field.value !== true)} label={field.label} />;
  }
  if (field.type === "dropdown") {
    const options = field.options ?? [];
    return (
      <select value={stored} onChange={(e) => onSave(e.target.value)} {...focusBorder} style={{ ...FIELD_INPUT_STYLE, cursor: "pointer" }}>
        <option value="">Select…</option>
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
        {stored && !options.includes(stored) && <option value={stored}>{stored}</option>}
      </select>
    );
  }

  const inputType = field.type === "number" ? "number" : field.type === "date" ? "date" : field.type === "link" ? "url" : "text";
  return (
    <div className="flex items-center gap-1.5 w-full">
      <DraftInput key={stored} value={stored} type={inputType} draftKey={draftKey} placeholder={field.type === "link" ? "https://" : undefined} onSave={onSave} />
      {field.type === "link" && stored && (
        <a href={stored} target="_blank" rel="noreferrer" title="Open link" className="flex items-center justify-center rounded shrink-0" style={{ width: 28, height: 28, color: "#2FBEB3" }}>
          <LinkIcon />
        </a>
      )}
    </div>
  );
}

interface InfoDraft {
  company: string;
  niche: string;
  contact: string;
  phone: string;
  source: string;
  assignee: string;
}

function infoDraftFromLead(lead: LeadDetail): InfoDraft {
  return { company: lead.company, niche: lead.niche, contact: lead.contact, phone: lead.phone, source: lead.source, assignee: lead.assignee };
}

function InfoCard({ lead, role, onLeadChange }: { lead: LeadDetail; role: UserRole; onLeadChange: (update: LeadUpdate) => void }) {
  const infoDraftKey = leadDraftKey(lead.id, "info");
  const [draft, setDraft] = useState<InfoDraft | null>(() => {
    const saved = readDraft<Partial<InfoDraft>>(infoDraftKey);
    return saved ? { ...infoDraftFromLead(lead), ...saved } : null;
  });
  const [editing, setEditing] = useState(draft !== null);
  const clearInfoDraft = useFormDraft(editing ? infoDraftKey : null, draft, {
    isEmpty: (value) => !value || (Object.keys(value) as (keyof InfoDraft)[]).every((key) => value[key] === lead[key]),
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [assignees, setAssignees] = useState<string[]>([]);
  const [sources, setSources] = useState<string[]>(DEFAULT_SOURCES);

  useEffect(() => {
    if (!editing || role !== "superadmin") return;
    let cancelled = false;
    const load = async () => {
      try {
        const [usersResponse, sourcesResponse] = await Promise.all([fetch("/api/users"), fetch("/api/lead-sources")]);
        const usersResult = await usersResponse.json().catch(() => ({})) as { users?: { name: string; status: string }[] };
        const sourcesResult = await sourcesResponse.json().catch(() => ({})) as { sources?: { name: string }[] };
        if (cancelled) return;
        setAssignees((usersResult.users ?? []).filter((user) => user.status === "active").map((user) => user.name));
        if (sourcesResult.sources?.length) setSources(sourcesResult.sources.map((source) => source.name));
      } catch {
        // Source stays free-text and the assignee select keeps the current assignee.
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [editing, role]);

  const handleCopy = () => {
    navigator.clipboard.writeText(lead.phone).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const startEditing = () => {
    setDraft({ ...infoDraftFromLead(lead), ...readDraft<Partial<InfoDraft>>(infoDraftKey) });
    setError("");
    setEditing(true);
  };

  const save = async () => {
    if (!draft) return;
    const next = {
      company: draft.company.trim(),
      niche: draft.niche.trim(),
      contact: draft.contact.trim(),
      phone: draft.phone.trim(),
      source: draft.source.trim(),
    };
    if (!next.company) { setError("Company name is required."); return; }

    const body: Record<string, string> = {};
    for (const key of Object.keys(next) as (keyof typeof next)[]) {
      if (next[key] !== lead[key]) body[key] = next[key];
    }
    const assigneeName = role === "superadmin" && draft.assignee && draft.assignee !== lead.assignee ? draft.assignee : "";
    if (assigneeName) body.assigneeName = assigneeName;
    if (Object.keys(body).length === 0) { clearInfoDraft(); setEditing(false); return; }

    setSaving(true);
    setError("");
    try {
      await patchLead(lead.id, body);
      clearInfoDraft();
      onLeadChange((prev) => ({
        ...prev,
        ...next,
        ...(assigneeName
          ? { assignee: assigneeName, assigneeInitials: initials(assigneeName), assigneeColor: assigneeColor(assigneeName) }
          : {}),
      }));
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save changes.");
    } finally {
      setSaving(false);
    }
  };

  const editAction = !editing ? (
    <button
      type="button"
      onClick={startEditing}
      className="flex items-center gap-1 rounded-md font-semibold"
      style={{ height: 24, paddingInline: 8, fontSize: 11, color: "#0E7A70", background: "#E3F7F5" }}
    >
      <PencilIcon /> Edit
    </button>
  ) : undefined;

  if (editing && draft) {
    const setField = (key: keyof InfoDraft) => (e: { target: { value: string } }) => setDraft((prev) => prev && { ...prev, [key]: e.target.value });
    const assigneeOptions = assignees.includes(lead.assignee) ? assignees : [lead.assignee, ...assignees];
    const sourceListId = `lead-sources-${lead.id}`;
    return (
      <Card title="Info">
        <div className="flex flex-col gap-3">
          <EditRow label="Company">
            <input value={draft.company} onChange={setField("company")} {...focusBorder} style={FIELD_INPUT_STYLE} autoFocus />
          </EditRow>
          <EditRow label="Niche">
            <input value={draft.niche} onChange={setField("niche")} {...focusBorder} style={FIELD_INPUT_STYLE} />
          </EditRow>
          <EditRow label="Contact">
            <input value={draft.contact} onChange={setField("contact")} {...focusBorder} style={FIELD_INPUT_STYLE} />
          </EditRow>
          <EditRow label="Phone">
            <input type="tel" value={draft.phone} onChange={setField("phone")} {...focusBorder} style={FIELD_INPUT_STYLE} />
          </EditRow>
          <EditRow label="Source">
            <input list={sourceListId} value={draft.source} onChange={setField("source")} {...focusBorder} style={FIELD_INPUT_STYLE} />
            <datalist id={sourceListId}>
              {sources.map((source) => <option key={source} value={source} />)}
            </datalist>
          </EditRow>
          <EditRow label="Assignee">
            {role === "superadmin" ? (
              <select value={draft.assignee} onChange={setField("assignee")} {...focusBorder} style={{ ...FIELD_INPUT_STYLE, cursor: "pointer" }}>
                {assigneeOptions.map((name) => <option key={name} value={name}>{name}</option>)}
              </select>
            ) : (
              <span style={{ fontSize: 13, color: "#9CA3AF" }}>{lead.assignee}</span>
            )}
          </EditRow>
          {error && <p role="alert" style={{ fontSize: 12, color: "#DC2626" }}>{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => { clearInfoDraft(); setEditing(false); setError(""); }}
              className="rounded-lg font-semibold"
              style={{ height: 32, paddingInline: 14, fontSize: 12, color: "#374151", background: "#F3F4F6" }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void save()}
              disabled={saving}
              className="rounded-lg font-semibold"
              style={{ height: 32, paddingInline: 14, fontSize: 12, color: "#FFFFFF", background: "#2FBEB3", opacity: saving ? 0.7 : 1 }}
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card title="Info" action={editAction}>
      <div className="flex flex-col gap-3">
        <InfoRow label="Company" value={lead.company} />
        <InfoRow label="Niche" value={lead.niche} />
        <InfoRow label="Contact" value={lead.contact} />
        <div className="flex items-center justify-between">
          <span style={{ fontSize: 12, color: "#6B7280" }}>Phone</span>
          <div className="flex items-center gap-1.5">
            <span style={{ fontSize: 13, fontWeight: 500, color: lead.phone ? "#111111" : "#9CA3AF" }}>{lead.phone || "—"}</span>
            {lead.phone && (
              <button
                onClick={handleCopy}
                className="flex items-center justify-center rounded"
                style={{ width: 22, height: 22, color: copied ? "#2FBEB3" : "#9CA3AF", background: copied ? "#E3F7F5" : "transparent" }}
                title="Copy phone"
              >
                {copied ? <CheckIcon size={11} /> : <CopyIcon />}
              </button>
            )}
          </div>
        </div>
        <div className="flex items-center justify-between">
          <span style={{ fontSize: 12, color: "#6B7280" }}>Source</span>
          {lead.source
            ? <span className="px-2.5 py-0.5 rounded-full" style={{ fontSize: 11, fontWeight: 600, background: "#E3F7F5", color: "#0E7A70" }}>{lead.source}</span>
            : <span style={{ fontSize: 13, color: "#9CA3AF" }}>—</span>}
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
  );
}

function EditRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span style={{ fontSize: 12, color: "#6B7280", flexShrink: 0, width: 64 }}>{label}</span>
      <div className="flex flex-1 justify-end min-w-0">{children}</div>
    </div>
  );
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
  leadId: string;
  initialTab?: Tab;
  onClose?: () => void;
  onDelete?: (leadId: string, reason: string) => void;
}

export function LeadDetailPanel({ role, leadId, initialTab = "details", onClose, onDelete }: LeadDetailPanelProps) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [lead, setLead] = useState<LeadDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pendingLost, setPendingLost] = useState(false);
  const [pendingReassign, setPendingReassign] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(false);
  const { stages } = usePipelineStages();

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const response = await fetch(`/api/leads/${leadId}`);
        const result = await response.json() as { lead?: ApiLeadDetail; error?: string };
        if (!response.ok || !result.lead) {
          if (!cancelled) setError(result.error ?? "Unable to load lead.");
          return;
        }
        if (!cancelled) setLead(toLeadDetail(result.lead));
      } catch {
        if (!cancelled) setError("Unable to load lead.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [leadId]);

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

  if (loading || !lead) {
    return (
      <>
        {onClose && (
          <div className="fixed inset-0 z-40" style={{ background: "rgba(15,27,60,0.4)" }} onClick={onClose} />
        )}
        <div className="fixed top-0 right-0 h-full z-50 flex flex-col" style={{ width: 720, background: "#FFFFFF", boxShadow: "-8px 0 40px rgba(15,27,60,0.14)" }}>
          <div className="flex items-center gap-3 px-5 py-4" style={{ borderBottom: "1px solid #E3E7EF" }}>
            {onClose && (
              <button type="button" onClick={onClose} className="flex items-center justify-center rounded-lg shrink-0" style={{ width: 32, height: 32, color: "#6B7280", background: "#F3F4F6" }} aria-label="Close">
                <XIcon size={14} />
              </button>
            )}
            <p style={{ fontSize: 14, color: "#6B7280" }}>{loading ? "Loading lead..." : error || "Unable to load lead."}</p>
          </div>
        </div>
      </>
    );
  }

  const updateLead = (update: LeadUpdate) => {
    setLead((prev) => (prev ? (typeof update === "function" ? update(prev) : update) : prev));
  };

  const applyStageChange = async (newStage: string, lostReason?: LostReason) => {
    const previous = lead;
    setLead((prev) => prev ? ({
      ...prev,
      stage: newStage,
      priority: priorityForStage(newStage),
      ...(newStage === "Closed Lost" && lostReason ? { lostReason } : {}),
      ...(newStage !== "Closed Lost" ? { lostReason: undefined } : {}),
    }) : prev);
    try {
      const response = await fetch("/api/leads", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [lead.id], stage: newStage, lostReason }),
      });
      const result = await response.json().catch(() => ({})) as {
        error?: string;
        activities?: ApiLeadDetail["activities"];
      };
      if (!response.ok) {
        setLead(previous);
        setError(result.error ?? "Unable to update stage.");
        return;
      }
      const created = (result.activities ?? []).map(toActivityEntry);
      if (created.length > 0) {
        const latest = created[0];
        setLead((prev) => prev ? ({
          ...prev,
          activity: [...created, ...prev.activity],
          lastContacted: { outcome: latest.outcome, relativeTime: latest.relativeTime, note: latest.notes },
        }) : prev);
      }
      setError("");
    } catch {
      setLead(previous);
      setError("Unable to update stage.");
    }
  };

  const requestStageChange = (newStage: string) => {
    if (newStage === "Closed Lost" && lead.stage !== "Closed Lost") {
      setPendingLost(true);
      return;
    }
    applyStageChange(newStage);
  };

  const handleReassign = (assignee: (typeof ASSIGNEES)[number]) => {
    setLead((prev) => prev ? ({
      ...prev,
      assignee: assignee.name,
      assigneeInitials: assignee.initials,
      assigneeColor: assignee.color,
    }) : prev);
    setPendingReassign(false);
  };

  const handleDelete = (reason: string) => {
    onDelete?.(lead.id, reason);
    setPendingDelete(false);
    onClose?.();
  };

  const nextStage = nextStageName(stages, lead.stage);

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
              <StageSelector stage={lead.stage} stages={stages} onChange={requestStageChange} />
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
          {error && <p style={{ padding: "12px 20px 0", fontSize: 13, color: "#DC2626" }}>{error}</p>}
          {tab === "details" && <DetailsTab lead={lead} role={role} stages={stages} onLeadChange={updateLead} onMarkDead={() => requestStageChange("Dead Lead")} />}
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
