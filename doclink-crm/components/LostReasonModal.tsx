"use client";

import { useEffect, useState } from "react";
import {
  LOST_REASON_OPTIONS,
  OTHER_LOST_REASON,
  formatLostReason,
  type LostReason,
  type LostReasonOption,
} from "@/lib/lost-reasons";

export { LOST_REASON_OPTIONS, type LostReason };

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

function AlertIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

// ─── Modal ────────────────────────────────────────────────────────────────────

interface LostReasonModalProps {
  companyName: string;
  onConfirm: (reason: LostReason) => void;
  onCancel: () => void;
}

export function LostReasonModal({ companyName, onConfirm, onCancel }: LostReasonModalProps) {
  const [reason, setReason] = useState<LostReasonOption | null>(null);
  const [otherDetail, setOtherDetail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const isOther = reason === OTHER_LOST_REASON;
  const reasonError = submitted && !reason;
  const otherDetailError = submitted && isOther && !otherDetail.trim();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onCancel]);

  const handleConfirm = () => {
    setSubmitted(true);
    if (!reason) return;
    if (reason === OTHER_LOST_REASON && !otherDetail.trim()) return;
    onConfirm(formatLostReason(reason, otherDetail));
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center"
      style={{ background: "rgba(15,27,60,0.45)" }}
      onClick={onCancel}
      role="presentation"
    >
      <div
        className="flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-labelledby="lost-reason-title"
        style={{
          width: 440,
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
            <h3 id="lost-reason-title" style={{ fontSize: 15, fontWeight: 700, color: "#111111" }}>
              Lost Reason
              <span style={{ color: "#9CA3AF", fontWeight: 400, marginLeft: 6 }}>—</span>
              <span style={{ color: "#57534E", fontWeight: 600, marginLeft: 6 }}>{companyName}</span>
            </h3>
            <p style={{ fontSize: 12, color: "#6B7280", marginTop: 4 }}>
              Required before moving to Closed Lost
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="flex items-center justify-center rounded-lg"
            style={{ width: 30, height: 30, background: "#F3F4F6", color: "#6B7280" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#E5E7EB"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#F3F4F6"; }}
            aria-label="Cancel"
          >
            <XIcon />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-3">
          <div className="flex items-center justify-between mb-1">
            <label style={{ fontSize: 12, fontWeight: 700, color: "#374151", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Why was this deal lost? <span style={{ color: "#DC2626" }}>*</span>
            </label>
            {reasonError && (
              <span className="flex items-center gap-1" style={{ fontSize: 11, color: "#DC2626" }}>
                <AlertIcon /> Select a reason
              </span>
            )}
          </div>

          {LOST_REASON_OPTIONS.map((option) => {
            const selected = reason === option;
            return (
              <button
                key={option}
                type="button"
                onClick={() => setReason(option)}
                className="w-full flex items-center gap-3 rounded-lg text-left transition-all"
                style={{
                  padding: "10px 12px",
                  fontSize: 13,
                  fontWeight: selected ? 600 : 500,
                  color: selected ? "#57534E" : "#374151",
                  background: selected ? "#F5F5F4" : "#FFFFFF",
                  border: `1.5px solid ${selected ? "#57534E" : reasonError ? "#FCA5A5" : "#E3E7EF"}`,
                  boxShadow: selected ? "0 1px 4px rgba(87,83,78,0.12)" : "none",
                }}
                onMouseEnter={(e) => {
                  if (!selected) (e.currentTarget as HTMLButtonElement).style.background = "#FAFAF9";
                }}
                onMouseLeave={(e) => {
                  if (!selected) (e.currentTarget as HTMLButtonElement).style.background = "#FFFFFF";
                }}
              >
                <span
                  className="flex items-center justify-center shrink-0 rounded-full"
                  style={{
                    width: 18,
                    height: 18,
                    border: `2px solid ${selected ? "#57534E" : "#D1D5DB"}`,
                    background: selected ? "#57534E" : "transparent",
                    color: "#FFFFFF",
                  }}
                >
                  {selected && <CheckIcon />}
                </span>
                {option}
              </button>
            );
          })}

          {isOther && (
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="lost-reason-other"
                style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}
              >
                Specify the reason <span style={{ color: "#DC2626" }}>*</span>
              </label>
              <textarea
                id="lost-reason-other"
                autoFocus
                rows={3}
                maxLength={500}
                value={otherDetail}
                onChange={(e) => setOtherDetail(e.target.value)}
                placeholder="Describe why this deal was lost…"
                className="w-full rounded-lg outline-none resize-none"
                style={{
                  padding: "10px 12px",
                  fontSize: 13,
                  color: "#111111",
                  border: `1.5px solid ${otherDetailError ? "#FCA5A5" : "#E3E7EF"}`,
                  background: otherDetailError ? "#FFF8F8" : "#FFFFFF",
                }}
                onFocus={(e) => { if (!otherDetailError) e.currentTarget.style.borderColor = "#57534E"; }}
                onBlur={(e) => { if (!otherDetailError) e.currentTarget.style.borderColor = "#E3E7EF"; }}
              />
              {otherDetailError && (
                <span className="flex items-center gap-1" style={{ fontSize: 11, color: "#DC2626" }}>
                  <AlertIcon /> Please describe the reason
                </span>
              )}
            </div>
          )}

          {reasonError && (
            <div
              className="mt-1 rounded-lg px-3 py-2 flex items-center gap-2"
              style={{ background: "#FFF8F8", border: "1px solid #FCA5A5" }}
            >
              <AlertIcon />
              <span style={{ fontSize: 12, color: "#DC2626" }}>
                Please select a lost reason to continue.
              </span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-end gap-3 px-6 py-4 shrink-0"
          style={{ borderTop: "1px solid #E3E7EF" }}
        >
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg font-semibold"
            style={{ height: 38, paddingInline: 18, fontSize: 13, color: "#374151", background: "#F3F4F6" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#E5E7EB"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#F3F4F6"; }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="rounded-lg font-semibold"
            style={{ height: 38, paddingInline: 20, fontSize: 13, color: "#FFFFFF", background: "#57534E" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#44403C"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#57534E"; }}
          >
            Mark Closed Lost
          </button>
        </div>
      </div>
    </div>
  );
}

export default LostReasonModal;
