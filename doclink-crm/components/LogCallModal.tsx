"use client";

import { useState, useEffect } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

export type CallOutcome =
  | "answered"
  | "no_answer"
  | "callback_requested"
  | "voicemail"
  | "proposal_discussed"
  | "meeting_set";

export type Outcome = CallOutcome | null;

export interface LogCallForm {
  outcome: Outcome;
  notes: string;
  followUpDate: string;
  followUpTime: string;
}

interface OutcomeMeta {
  label: string;
  bg: string;
  text: string;
  border: string;
}

// ─── Outcome config ───────────────────────────────────────────────────────────

const OUTCOMES: { key: Exclude<Outcome, null>; meta: OutcomeMeta }[] = [
  {
    key: "answered",
    meta: { label: "Answered",          bg: "#16A34A", text: "#FFFFFF", border: "#16A34A" },
  },
  {
    key: "no_answer",
    meta: { label: "No Answer",         bg: "#D97706", text: "#FFFFFF", border: "#D97706" },
  },
  {
    key: "callback_requested",
    meta: { label: "Callback Requested", bg: "#6366F1", text: "#FFFFFF", border: "#6366F1" },
  },
  {
    key: "voicemail",
    meta: { label: "Voicemail Left",    bg: "#9CA3AF", text: "#FFFFFF", border: "#9CA3AF" },
  },
  {
    key: "proposal_discussed",
    meta: { label: "Proposal Discussed", bg: "#4338CA", text: "#FFFFFF", border: "#4338CA" },
  },
  {
    key: "meeting_set",
    meta: { label: "Meeting Set",       bg: "#F59E0B", text: "#FFFFFF", border: "#F59E0B" },
  },
];

// Outcomes that require a follow-up schedule
const REQUIRES_FOLLOWUP = new Set<Exclude<Outcome, null>>(["no_answer", "callback_requested"]);

// ─── Icons ────────────────────────────────────────────────────────────────────

function XIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

// ─── Outcome chip ─────────────────────────────────────────────────────────────

function OutcomeChip({
  outcomeKey,
  meta,
  selected,
  onClick,
}: {
  outcomeKey: Exclude<Outcome, null>;
  meta: OutcomeMeta;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1.5 rounded-full font-semibold whitespace-nowrap"
      style={{
        height: 32,
        paddingInline: 14,
        fontSize: 12,
        background: selected ? meta.bg : "transparent",
        color: selected ? meta.text : "#6B7280",
        border: `1.5px solid ${selected ? meta.border : "#E3E7EF"}`,
        transition: "all 140ms",
        boxShadow: selected ? `0 1px 6px ${meta.bg}40` : "none",
      }}
      onMouseEnter={(e) => {
        if (!selected) {
          (e.currentTarget as HTMLButtonElement).style.borderColor = meta.border;
          (e.currentTarget as HTMLButtonElement).style.color = meta.bg;
          (e.currentTarget as HTMLButtonElement).style.background = `${meta.bg}0D`;
        }
      }}
      onMouseLeave={(e) => {
        if (!selected) {
          (e.currentTarget as HTMLButtonElement).style.borderColor = "#E3E7EF";
          (e.currentTarget as HTMLButtonElement).style.color = "#6B7280";
          (e.currentTarget as HTMLButtonElement).style.background = "transparent";
        }
      }}
    >
      {selected && <CheckIcon />}
      {meta.label}
    </button>
  );
}

// ─── Date / time input ────────────────────────────────────────────────────────

function DateTimeInput({
  type,
  value,
  onChange,
  error,
  icon,
}: {
  type: "date" | "time";
  value: string;
  onChange: (v: string) => void;
  error?: boolean;
  icon: React.ReactNode;
}) {
  const [focused, setFocused] = useState(false);
  const borderColor = error ? "#DC2626" : focused ? "#2FBEB3" : "#C7EAE7";

  return (
    <div className="relative flex-1">
      <div
        className="absolute flex items-center justify-center"
        style={{ left: 10, top: "50%", transform: "translateY(-50%)", color: error ? "#DC2626" : "#0E7A70", pointerEvents: "none" }}
      >
        {icon}
      </div>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        className="w-full rounded-lg"
        style={{
          height: 38,
          paddingLeft: 32,
          paddingRight: 10,
          border: `1.5px solid ${borderColor}`,
          fontSize: 13,
          color: "#111111",
          background: "transparent",
          outline: "none",
          transition: "border-color 120ms",
        }}
      />
    </div>
  );
}

// ─── Main modal ───────────────────────────────────────────────────────────────

interface LogCallModalProps {
  companyName?: string;
  initialOutcome?: Outcome;
  onClose?: () => void;
  onSave?: (data: LogCallForm) => void | Promise<void>;
}

export function LogCallModal({
  companyName = "Meridian Corp",
  initialOutcome = null,
  onClose,
  onSave,
}: LogCallModalProps) {
  const [form, setForm] = useState<LogCallForm>({
    outcome: initialOutcome,
    notes: "",
    followUpDate: "",
    followUpTime: "",
  });
  const [submitted, setSubmitted] = useState(false);
  const [saveError, setSaveError] = useState("");

  const requiresFollowUp = form.outcome && REQUIRES_FOLLOWUP.has(form.outcome);
  const outcomeError = submitted && !form.outcome;
  const followUpDateError = submitted && requiresFollowUp && !form.followUpDate;
  const followUpTimeError = submitted && requiresFollowUp && !form.followUpTime;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape" && onClose) onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const handleSave = async () => {
    setSubmitted(true);
    setSaveError("");
    if (!form.outcome) return;
    if (requiresFollowUp && (!form.followUpDate || !form.followUpTime)) return;
    try {
      await onSave?.(form);
      onClose?.();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Unable to save this call.");
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center"
      style={{ background: "rgba(15,27,60,0.45)" }}
      onClick={onClose}
    >
      <div
        className="flex flex-col"
        style={{
          width: 480,
          background: "#FFFFFF",
          borderRadius: 12,
          boxShadow: "0 8px 48px rgba(15,27,60,0.18)",
          border: "1px solid #E3E7EF",
          maxHeight: "90vh",
          overflow: "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4 shrink-0"
          style={{ borderBottom: "1px solid #E3E7EF" }}
        >
          <div>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: "#111111" }}>
              Log Call
              <span style={{ color: "#9CA3AF", fontWeight: 400, marginLeft: 6 }}>—</span>
              <span style={{ color: "#2FBEB3", fontWeight: 600, marginLeft: 6 }}>{companyName}</span>
            </h3>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="flex items-center justify-center rounded-lg"
              style={{ width: 30, height: 30, background: "#F3F4F6", color: "#6B7280" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#E5E7EB"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#F3F4F6"; }}
            >
              <XIcon />
            </button>
          )}
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-5">

          {/* Outcome chips */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label style={{ fontSize: 12, fontWeight: 700, color: "#374151", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Outcome <span style={{ color: "#DC2626" }}>*</span>
              </label>
              {outcomeError && (
                <span className="flex items-center gap-1" style={{ fontSize: 11, color: "#DC2626" }}>
                  <AlertIcon /> Select an outcome
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {OUTCOMES.map(({ key, meta }) => (
                <OutcomeChip
                  key={key}
                  outcomeKey={key}
                  meta={meta}
                  selected={form.outcome === key}
                  onClick={() => setForm((prev) => ({ ...prev, outcome: prev.outcome === key ? null : key }))}
                />
              ))}
            </div>
            {outcomeError && (
              <div
                className="mt-2.5 rounded-lg px-3 py-2 flex items-center gap-2"
                style={{ background: "#FFF8F8", border: "1px solid #FCA5A5" }}
              >
                <AlertIcon />
                <span style={{ fontSize: 12, color: "#DC2626" }}>Please select an outcome before saving.</span>
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: "#374151", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 8 }}>
              Notes
            </label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
              placeholder="What happened on this call? Key points, objections, next steps…"
              rows={4}
              className="w-full rounded-lg px-3 py-2.5 resize-none"
              style={{
                border: "1.5px solid #E3E7EF",
                fontSize: 13,
                color: "#111111",
                lineHeight: 1.65,
                outline: "none",
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = "#2FBEB3"; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = "#E3E7EF"; }}
            />
          </div>

          {/* Conditional follow-up section */}
          {requiresFollowUp && (
            <div
              className="rounded-xl flex flex-col gap-4 px-4 py-4"
              style={{
                background: "#E3F7F5",
                border: "1.5px solid #A7F3D0",
                animation: "fadeSlideIn 180ms ease",
              }}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p style={{ fontSize: 13, fontWeight: 700, color: "#0E7A70" }}>Schedule Follow-up</p>
                  <p style={{ fontSize: 11, color: "#0E7A70", opacity: 0.8, marginTop: 2 }}>
                    Required for this outcome
                  </p>
                </div>
                <span
                  className="px-2.5 py-0.5 rounded-full text-xs font-semibold"
                  style={{ background: "#0E7A7020", color: "#0E7A70" }}
                >
                  Required
                </span>
              </div>

              <div className="flex gap-3">
                {/* Follow-up Date */}
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 11, fontWeight: 600, color: "#0E7A70", display: "block", marginBottom: 5 }}>
                    Date {followUpDateError && <span style={{ color: "#DC2626" }}>*</span>}
                  </label>
                  <DateTimeInput
                    type="date"
                    value={form.followUpDate}
                    onChange={(v) => setForm((prev) => ({ ...prev, followUpDate: v }))}
                    error={followUpDateError || undefined}
                    icon={<CalendarIcon />}
                  />
                  {followUpDateError && (
                    <p className="flex items-center gap-1 mt-1" style={{ fontSize: 11, color: "#DC2626" }}>
                      <AlertIcon /> Date is required
                    </p>
                  )}
                </div>

                {/* Follow-up Time */}
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 11, fontWeight: 600, color: "#0E7A70", display: "block", marginBottom: 5 }}>
                    Time {followUpTimeError && <span style={{ color: "#DC2626" }}>*</span>}
                  </label>
                  <DateTimeInput
                    type="time"
                    value={form.followUpTime}
                    onChange={(v) => setForm((prev) => ({ ...prev, followUpTime: v }))}
                    error={followUpTimeError || undefined}
                    icon={<ClockIcon />}
                  />
                  {followUpTimeError && (
                    <p className="flex items-center gap-1 mt-1" style={{ fontSize: 11, color: "#DC2626" }}>
                      <AlertIcon /> Time is required
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-end gap-3 px-6 py-4 shrink-0"
          style={{ borderTop: "1px solid #E3E7EF" }}
        >
          {saveError && <span className="mr-auto" style={{ fontSize: 12, color: "#DC2626" }}>{saveError}</span>}
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg font-semibold"
            style={{ height: 38, paddingInline: 18, fontSize: 13, color: "#374151", background: "#F3F4F6" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#E5E7EB"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#F3F4F6"; }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="rounded-lg font-semibold"
            style={{ height: 38, paddingInline: 20, fontSize: 13, color: "#FFFFFF", background: "#2FBEB3" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#0E7A70"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#2FBEB3"; }}
          >
            Save Call Log
          </button>
        </div>
      </div>

      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(-6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

// ─── Dev preview page ─────────────────────────────────────────────────────────

export function LogCallPage({ frame }: { frame: "answered" | "no_answer" }) {
  return (
    <div
      style={{
        minHeight: "calc(100vh - 64px)",
        background: "#F9FAFB",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 40,
      }}
    >
      <LogCallModal
        companyName="Meridian Corp"
        initialOutcome={frame}
      />
    </div>
  );
}

export default LogCallModal;
