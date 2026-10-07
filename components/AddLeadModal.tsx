"use client";

import { useState, useRef, useEffect, type ReactNode } from "react";
import type { UserRole } from "@/lib/types";
import { activeStages, stageColor } from "@/lib/pipeline-stages";
import { usePipelineStages } from "@/lib/use-pipeline-stages";
import { priorityForStage } from "@/lib/lead-ui";
import { REVENUE_CURRENCIES, YES_NO_OPTIONS, type RevenueCurrency, type YesNo } from "@/lib/lead-custom-fields";
import { readDraft, useFormDraft } from "@/lib/use-form-draft";
import { notifyCrmDataChanged } from "@/lib/crm-invalidation";

// ─── Types ────────────────────────────────────────────────────────────────────

type Priority = "hot" | "warm" | "cold" | null;

interface LeadForm {
  company: string;
  niche: string;
  contact: string;
  phone: string;
  source: string;
  priority: Priority;
  assignee: string;
  stage: string;
  revenueCurrency: RevenueCurrency;
  revenueAmount: string;
  discoveryCall: YesNo | "";
  proposalSent: boolean;
}

interface FormErrors {
  company?: string;
}

interface AssignableUser {
  id: string;
  name: string;
  initials: string;
  color: string;
}

// ─── Seed data ────────────────────────────────────────────────────────────────

const NICHES = [
  "Enterprise SaaS", "Healthcare", "Agency", "Deep Tech", "Infrastructure",
  "Fintech", "Clean Energy", "Consulting", "Real Estate", "Investment",
  "Logistics", "Retail", "Marketing", "Pharma",
];

const SOURCES = ["Referral", "Website", "Cold Call", "LinkedIn", "Trade Show", "Email Campaign", "Partner", "Event"];

const PRIORITY_COLOR: Record<Exclude<Priority, null>, string> = {
  hot: "#EF4444",
  warm: "#F59E0B",
  cold: "#3B82F6",
};

const EMPTY_FORM: LeadForm = {
  company: "",
  niche: "",
  contact: "",
  phone: "",
  source: "",
  priority: null,
  assignee: "",
  stage: "",
  revenueCurrency: "Rs",
  revenueAmount: "",
  discoveryCall: "",
  proposalSent: false,
};

const NEW_LEAD_DRAFT_KEY = "lead:new";

function isBlankLeadForm(form: LeadForm) {
  return !form.company.trim() && !form.niche && !form.contact.trim() && !form.phone.trim() && !form.source
    && !form.revenueAmount && !form.discoveryCall && !form.proposalSent;
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function XIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

// ─── Field primitives ─────────────────────────────────────────────────────────

function Label({ children, required }: { children: ReactNode; required?: boolean }) {
  return (
    <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>
      {children}
      {required && <span style={{ color: "#DC2626", marginLeft: 3 }}>*</span>}
    </label>
  );
}

function TextInput({
  value, onChange, placeholder, error, disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  error?: string;
  disabled?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  const borderColor = error ? "#DC2626" : focused ? "#2FBEB3" : "#E3E7EF";
  return (
    <div>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        className="w-full rounded-lg px-3"
        style={{
          height: 38,
          border: `1.5px solid ${borderColor}`,
          fontSize: 13,
          color: disabled ? "#9CA3AF" : "#111111",
          background: disabled ? "#F9FAFB" : "#FFFFFF",
          outline: "none",
          transition: "border-color 120ms",
        }}
      />
      {error && (
        <p className="flex items-center gap-1 mt-1.5" style={{ fontSize: 12, color: "#DC2626" }}>
          <AlertIcon /> {error}
        </p>
      )}
    </div>
  );
}

function SelectInput({
  value, onChange, options, placeholder, renderOption, renderValue,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder?: string;
  renderOption?: (o: string) => ReactNode;
  renderValue?: (v: string) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        className="w-full flex items-center justify-between rounded-lg px-3"
        style={{
          height: 38,
          border: `1.5px solid ${focused || open ? "#2FBEB3" : "#E3E7EF"}`,
          fontSize: 13,
          color: value ? "#111111" : "#9CA3AF",
          background: "#FFFFFF",
          transition: "border-color 120ms",
          textAlign: "left",
        }}
      >
        <span className="flex-1 truncate">
          {value ? (renderValue ? renderValue(value) : value) : (placeholder ?? "Select…")}
        </span>
        <span style={{ color: "#9CA3AF", flexShrink: 0 }}><ChevronDownIcon /></span>
      </button>

      {open && (
        <div
          className="absolute left-0 right-0 z-50 rounded-lg overflow-hidden"
          style={{ top: "calc(100% + 4px)", background: "#FFFFFF", border: "1px solid #E3E7EF", boxShadow: "0 4px 20px rgba(15,27,60,0.12)", maxHeight: 220, overflowY: "auto" }}
        >
          {options.map((o) => (
            <button
              key={o}
              type="button"
              onClick={() => { onChange(o); setOpen(false); }}
              className="w-full flex items-center px-3 py-2.5 text-left"
              style={{
                fontSize: 13,
                color: "#374151",
                background: value === o ? "#E3F7F5" : "transparent",
                fontWeight: value === o ? 600 : 400,
              }}
              onMouseEnter={(e) => { if (value !== o) (e.currentTarget as HTMLButtonElement).style.background = "#F9FAFB"; }}
              onMouseLeave={(e) => { if (value !== o) (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
            >
              {renderOption ? renderOption(o) : o}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Niche select with "+ Add new" option
function NicheSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const [niches, setNiches] = useState(NICHES);
  const [newNiche, setNewNiche] = useState("");
  const [addingNew, setAddingNew] = useState(false);
  const [focused, setFocused] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) { setOpen(false); setAddingNew(false); setNewNiche(""); } };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  const confirmNew = () => {
    const trimmed = newNiche.trim();
    if (!trimmed) return;
    if (!niches.includes(trimmed)) setNiches((prev) => [...prev, trimmed]);
    onChange(trimmed);
    setOpen(false);
    setAddingNew(false);
    setNewNiche("");
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        className="w-full flex items-center justify-between rounded-lg px-3"
        style={{ height: 38, border: `1.5px solid ${focused || open ? "#2FBEB3" : "#E3E7EF"}`, fontSize: 13, color: value ? "#111111" : "#9CA3AF", background: "#FFFFFF", textAlign: "left" }}
      >
        <span className="flex-1 truncate">{value || "Select niche…"}</span>
        <span style={{ color: "#9CA3AF", flexShrink: 0 }}><ChevronDownIcon /></span>
      </button>

      {open && (
        <div
          className="absolute left-0 right-0 z-50 rounded-lg overflow-hidden flex flex-col"
          style={{ top: "calc(100% + 4px)", background: "#FFFFFF", border: "1px solid #E3E7EF", boxShadow: "0 4px 20px rgba(15,27,60,0.12)", maxHeight: 240 }}
        >
          <div className="overflow-y-auto flex-1">
            {niches.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => { onChange(n); setOpen(false); }}
                className="w-full text-left px-3 py-2.5"
                style={{ fontSize: 13, color: "#374151", background: value === n ? "#E3F7F5" : "transparent", fontWeight: value === n ? 600 : 400 }}
                onMouseEnter={(e) => { if (value !== n) (e.currentTarget as HTMLButtonElement).style.background = "#F9FAFB"; }}
                onMouseLeave={(e) => { if (value !== n) (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
              >
                {n}
              </button>
            ))}
          </div>
          <div style={{ borderTop: "1px solid #F3F4F6", padding: "8px" }}>
            {!addingNew ? (
              <button
                type="button"
                onClick={() => setAddingNew(true)}
                className="w-full text-left px-3 py-2 rounded-lg"
                style={{ fontSize: 13, color: "#2FBEB3", fontWeight: 600 }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#E3F7F5"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
              >
                + Add new niche
              </button>
            ) : (
              <div className="flex items-center gap-2 px-1">
                <input
                  autoFocus
                  value={newNiche}
                  onChange={(e) => setNewNiche(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") confirmNew(); if (e.key === "Escape") { setAddingNew(false); setNewNiche(""); } }}
                  placeholder="Niche name…"
                  className="flex-1 rounded-lg px-2"
                  style={{ height: 32, border: "1.5px solid #2FBEB3", fontSize: 13, color: "#111111", outline: "none" }}
                />
                <button
                  type="button"
                  onClick={confirmNew}
                  className="rounded-lg px-3 font-semibold"
                  style={{ height: 32, background: "#2FBEB3", color: "#FFFFFF", fontSize: 12 }}
                >
                  Add
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Modal ───────────────────────────────────────────────────────────────

interface AddLeadModalProps {
  mode?: "add" | "edit";
  role: UserRole;
  showValidation?: boolean;
  onClose?: () => void;
}

export function AddLeadModal({ mode = "add", role, showValidation = false, onClose }: AddLeadModalProps) {
  const draftKey = mode === "add" ? NEW_LEAD_DRAFT_KEY : null;
  const [form, setForm] = useState<LeadForm>(() => ({ ...EMPTY_FORM, ...readDraft<Partial<LeadForm>>(draftKey) }));
  const clearDraft = useFormDraft(draftKey, form, { isEmpty: isBlankLeadForm });
  const [assignees, setAssignees] = useState<AssignableUser[]>([]);
  const { stages } = usePipelineStages();
  const stageOptions = activeStages(stages);
  const [errors, setErrors] = useState<FormErrors>(showValidation ? { company: "Company name is required" } : {});
  const [submitted, setSubmitted] = useState(showValidation);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    if (role !== "superadmin") return;
    const loadAssignees = async () => {
      try {
        const response = await fetch("/api/users");
        const result = await response.json() as { users?: Array<AssignableUser & { status: string }>; error?: string };
        if (!response.ok) {
          setSaveError(result.error ?? "Unable to load users.");
          return;
        }
        const activeUsers = (result.users ?? []).filter((user) => user.status === "active");
        setAssignees(activeUsers);
        if (activeUsers.length > 0) setForm((prev) => ({ ...prev, assignee: prev.assignee || activeUsers[0].name }));
      } catch {
        setSaveError("Unable to load users.");
      }
    };
    void loadAssignees();
  }, [role]);

  useEffect(() => {
    const options = activeStages(stages);
    if (options.length === 0) return;
    setForm((prev) => {
      if (options.some((stage) => stage.name === prev.stage)) return prev;
      const fallback = options.find((stage) => stage.isDefault) ?? options[0];
      return { ...prev, stage: fallback.name, priority: priorityForStage(fallback.name) };
    });
  }, [stages]);

  const set = <K extends keyof LeadForm>(key: K, val: LeadForm[K]) => {
    setForm((prev) => ({
      ...prev,
      [key]: val,
      ...(key === "stage" ? { priority: priorityForStage(val as string) } : {}),
    }));
    if (key === "company" && submitted) {
      setErrors((prev) => ({ ...prev, company: val ? undefined : "Company name is required" }));
    }
  };

  const handleSave = async () => {
    setSubmitted(true);
    const newErrors: FormErrors = {};
    if (!form.company.trim()) newErrors.company = "Company name is required";
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0 || mode === "edit") return;

    setSaveError("");
    setSaving(true);
    try {
      const response = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company: form.company,
          niche: form.niche,
          contact: form.contact,
          phone: form.phone,
          source: form.source,
          priority: form.priority,
          assigneeName: role === "superadmin" ? form.assignee : undefined,
          stage: form.stage,
          monthlyRevenue: { currency: form.revenueCurrency, amount: form.revenueAmount },
          discoveryCall: form.discoveryCall,
          proposalSent: form.proposalSent,
        }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) {
        setSaveError(result.error ?? "Unable to save lead.");
        return;
      }
      notifyCrmDataChanged("leads", "followups", "dashboard", "notifications");
      clearDraft();
      onClose?.();
    } catch {
      setSaveError("Unable to reach the server. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const assignee = assignees.find((a) => a.name === form.assignee);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape" && onClose) onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(15,27,60,0.45)" }}
      onClick={onClose}
    >
      <div
        className="flex flex-col"
        style={{ width: 560, maxHeight: "90vh", background: "#FFFFFF", borderRadius: 12, boxShadow: "0 8px 48px rgba(15,27,60,0.18)", border: "1px solid #E3E7EF" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4 shrink-0"
          style={{ borderBottom: "1px solid #E3E7EF" }}
        >
          <h3 style={{ fontSize: 16, fontWeight: 700, color: "#111111" }}>
            {mode === "edit" ? "Edit Lead" : "Add New Lead"}
          </h3>
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
        <div className="flex-1 overflow-y-auto px-6 py-5" style={{ display: "flex", flexDirection: "column", gap: 14 }}>

          {/* Company */}
          <div>
            <Label required>Company</Label>
            <TextInput
              value={form.company}
              onChange={(v) => set("company", v)}
              placeholder="e.g. Meridian Corp"
              error={errors.company}
            />
          </div>

          {/* Niche */}
          <div>
            <Label>Niche</Label>
            <NicheSelect value={form.niche} onChange={(v) => set("niche", v)} />
          </div>

          {/* Contact Name */}
          <div>
            <Label>Contact Name</Label>
            <TextInput value={form.contact} onChange={(v) => set("contact", v)} placeholder="e.g. Sarah Blake" />
          </div>

          {/* Phone */}
          <div>
            <Label>Phone</Label>
            <TextInput value={form.phone} onChange={(v) => set("phone", v)} placeholder="+1 555 000 0000" />
          </div>

          {/* Source */}
          <div>
            <Label>Source</Label>
            <SelectInput
              value={form.source}
              onChange={(v) => set("source", v)}
              options={SOURCES}
              placeholder="Select source…"
            />
          </div>

          {/* Priority segmented */}
          <div>
            <Label>Priority</Label>
            <div className="flex rounded-lg overflow-hidden" style={{ border: "1.5px solid #E3E7EF" }}>
              {(["hot", "warm", "cold"] as Exclude<Priority, null>[]).map((p, i) => {
                const active = form.priority === p;
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => set("priority", active ? null : p)}
                    className="flex-1 flex items-center justify-center gap-2 font-semibold capitalize"
                    style={{
                      height: 38,
                      fontSize: 13,
                      background: active ? `${PRIORITY_COLOR[p]}14` : "#FFFFFF",
                      color: active ? PRIORITY_COLOR[p] : "#9CA3AF",
                      borderRight: i < 2 ? "1px solid #E3E7EF" : undefined,
                      transition: "all 120ms",
                    }}
                    onMouseEnter={(e) => { if (!active) (e.currentTarget as HTMLButtonElement).style.background = "#F9FAFB"; }}
                    onMouseLeave={(e) => { if (!active) (e.currentTarget as HTMLButtonElement).style.background = "#FFFFFF"; }}
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ background: active ? PRIORITY_COLOR[p] : "#D1D5DB" }}
                    />
                    {p.charAt(0).toUpperCase() + p.slice(1)}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Assignee — superadmin only */}
          <div>
            <Label>Assignee</Label>
            {role === "superadmin" ? (
              <SelectInput
                value={form.assignee}
                onChange={(v) => set("assignee", v)}
                options={assignees.map((a) => a.name)}
                renderOption={(name) => {
                  const a = assignees.find((x) => x.name === name);
                  if (!a) return name;
                  return (
                    <div className="flex items-center gap-2.5">
                      <span className="w-6 h-6 rounded-full flex items-center justify-center text-white font-bold shrink-0" style={{ background: a.color, fontSize: 10 }}>{a.initials}</span>
                      <span>{name}</span>
                    </div>
                  );
                }}
                renderValue={(name) => {
                  const a = assignees.find((x) => x.name === name);
                  if (!a) return name;
                  return (
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full flex items-center justify-center text-white font-bold" style={{ background: a.color, fontSize: 9 }}>{a.initials}</span>
                      <span>{name}</span>
                    </div>
                  );
                }}
              />
            ) : (
              <div
                className="flex items-center gap-2.5 rounded-lg px-3"
                style={{ height: 38, border: "1.5px solid #E3E7EF", background: "#F9FAFB" }}
              >
                {assignee && (
                  <span className="w-5 h-5 rounded-full flex items-center justify-center text-white font-bold shrink-0" style={{ background: assignee.color, fontSize: 9 }}>{assignee.initials}</span>
                )}
                <span style={{ fontSize: 13, color: "#9CA3AF" }}>Assigned to you</span>
              </div>
            )}
          </div>

          {/* Stage */}
          <div>
            <Label>Stage</Label>
            <SelectInput
              value={form.stage}
              onChange={(v) => set("stage", v)}
              options={stageOptions.map((stage) => stage.name)}
              renderOption={(s) => (
                <div className="flex items-center gap-2.5">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: stageColor(stageOptions, s) }} />
                  <span>{s}</span>
                </div>
              )}
              renderValue={(s) => (
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: stageColor(stageOptions, s) }} />
                  <span>{s}</span>
                </div>
              )}
            />
          </div>

          {/* Custom Fields divider */}
          <div className="flex items-center gap-3" style={{ paddingTop: 4 }}>
            <div style={{ flex: 1, height: 1, background: "#E3E7EF" }} />
            <span style={{ fontSize: 11, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.08em", whiteSpace: "nowrap" }}>Custom Fields</span>
            <div style={{ flex: 1, height: 1, background: "#E3E7EF" }} />
          </div>

          {/* Custom: Monthly Revenue */}
          <div>
            <Label>Monthly Revenue</Label>
            <div className="flex gap-2">
              <div className="flex rounded-lg overflow-hidden shrink-0" style={{ border: "1.5px solid #E3E7EF", height: 38 }}>
                {REVENUE_CURRENCIES.map((currency, i) => {
                  const active = form.revenueCurrency === currency;
                  return (
                    <button
                      key={currency}
                      type="button"
                      onClick={() => set("revenueCurrency", currency)}
                      className="font-semibold"
                      style={{
                        width: 44,
                        fontSize: 13,
                        background: active ? "#E3F7F5" : "#FFFFFF",
                        color: active ? "#0E7A70" : "#9CA3AF",
                        borderRight: i < REVENUE_CURRENCIES.length - 1 ? "1px solid #E3E7EF" : undefined,
                      }}
                    >
                      {currency}
                    </button>
                  );
                })}
              </div>
              <div className="flex-1">
                <TextInput
                  value={form.revenueAmount}
                  onChange={(v) => set("revenueAmount", v.replace(/[^0-9.]/g, ""))}
                  placeholder={form.revenueCurrency === "Rs" ? "e.g. 50000" : "e.g. 1200"}
                />
              </div>
            </div>
          </div>

          {/* Custom: Discovery Call */}
          <div>
            <Label>Discovery Call</Label>
            <div className="flex rounded-lg overflow-hidden" style={{ border: "1.5px solid #E3E7EF" }}>
              {YES_NO_OPTIONS.map((option, i) => {
                const active = form.discoveryCall === option;
                const color = option === "Yes" ? "#16A34A" : "#DC2626";
                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => set("discoveryCall", active ? "" : option)}
                    className="flex-1 font-semibold"
                    style={{
                      height: 38,
                      fontSize: 13,
                      background: active ? `${color}14` : "#FFFFFF",
                      color: active ? color : "#9CA3AF",
                      borderRight: i < YES_NO_OPTIONS.length - 1 ? "1px solid #E3E7EF" : undefined,
                      transition: "all 120ms",
                    }}
                  >
                    {option}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Custom: Proposal Sent */}
          <div className="flex items-center justify-between">
            <span style={{ fontSize: 13, color: "#374151" }}>Proposal Sent</span>
            <button
              type="button"
              onClick={() => set("proposalSent", !form.proposalSent)}
              className="rounded-full flex items-center"
              style={{ width: 40, height: 22, background: form.proposalSent ? "#2FBEB3" : "#D1D5DB", padding: "0 2px", transition: "background 150ms" }}
            >
              <span
                className="rounded-full"
                style={{ width: 18, height: 18, background: "#FFFFFF", transform: form.proposalSent ? "translateX(18px)" : "translateX(0)", transition: "transform 150ms", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }}
              />
            </button>
          </div>
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-end gap-3 px-6 py-4 shrink-0"
          style={{ borderTop: "1px solid #E3E7EF" }}
        >
          {saveError && <p role="alert" style={{ marginRight: "auto", maxWidth: 280, fontSize: 12, color: "#DC2626" }}>{saveError}</p>}
          <button
            type="button"
            onClick={() => { clearDraft(); onClose?.(); }}
            className="rounded-lg font-semibold"
            style={{ height: 38, paddingInline: 18, fontSize: 13, color: "#374151", background: "#F3F4F6", border: "none" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#E5E7EB"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#F3F4F6"; }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="rounded-lg font-semibold"
            style={{ height: 38, paddingInline: 20, fontSize: 13, color: "#FFFFFF", background: "#2FBEB3" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#0E7A70"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#2FBEB3"; }}
          >
            {saving ? "Saving..." : mode === "edit" ? "Save Changes" : "Save Lead"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Page wrapper for the dev toolbar preview ─────────────────────────────────

export function AddLeadPage({ role, showValidation }: { role: UserRole; showValidation: boolean }) {
  return (
    <div style={{ minHeight: "calc(100vh - 64px)", background: "#F9FAFB", display: "flex", alignItems: "center", justifyContent: "center", padding: 40 }}>
      <AddLeadModal mode={showValidation ? "add" : "add"} role={role} showValidation={showValidation} />
    </div>
  );
}

export default AddLeadModal;
