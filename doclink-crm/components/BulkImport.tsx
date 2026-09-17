"use client";

import { useState, useRef, type ReactNode, type CSSProperties, type DragEvent } from "react";
import type { UserRole } from "@/lib/types";

// ─── Types ────────────────────────────────────────────────────────────────────

type Step = 1 | 2 | 3 | 4;
type DuplicateAction = "skip" | "import";

interface ColumnMapping {
  sourceHeader: string;
  targetField: string;
  confidence: "auto" | "confirm" | "ignored";
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DOCLINK_FIELDS = [
  "Company", "Contact Name", "Phone", "Niche", "Source",
  "Priority", "Assignee", "Stage", "Follow-up Date", "Notes",
  "Annual Revenue", "Company Size", "— Ignore field —",
];

const SAMPLE_SOURCE_HEADERS = [
  "company_name", "full_name", "mobile", "industry",
  "lead_source", "priority_level", "owner", "status", "next_follow_up",
];

const AUTO_MAPPINGS: Record<string, { field: string; confidence: "auto" | "confirm" }> = {
  company_name:   { field: "Company",        confidence: "auto" },
  full_name:      { field: "Contact Name",   confidence: "auto" },
  mobile:         { field: "Phone",          confidence: "auto" },
  industry:       { field: "Niche",          confidence: "confirm" },
  lead_source:    { field: "Source",         confidence: "auto" },
  priority_level: { field: "Priority",       confidence: "confirm" },
  owner:          { field: "Assignee",       confidence: "auto" },
  status:         { field: "Stage",          confidence: "confirm" },
  next_follow_up: { field: "Follow-up Date", confidence: "auto" },
};

const PREVIEW_ROWS = [
  { company_name: "Apex Dynamics",    full_name: "Oliver Chen",    mobile: "+1 555 210 4491", industry: "SaaS",       lead_source: "LinkedIn",  priority_level: "Hot",  owner: "James Carter",  status: "New Lead",      next_follow_up: "2026-09-20" },
  { company_name: "Blue Ridge Co.",   full_name: "Nina Patel",     mobile: "+1 555 773 8812", industry: "Retail",     lead_source: "Referral",  priority_level: "Warm", owner: "Aisha Santos",  status: "Conversation",  next_follow_up: "2026-09-18" },
  { company_name: "Clearwater Labs",  full_name: "David Müller",   mobile: "+1 555 344 6620", industry: "Pharma",     lead_source: "Trade Show",priority_level: "Cold", owner: "Derek Kim",     status: "New Lead",      next_follow_up: "2026-09-22" },
  { company_name: "Drift Analytics",  full_name: "Sara Johansson", mobile: "+1 555 890 1123", industry: "Fintech",    lead_source: "Website",   priority_level: "Hot",  owner: "Marco Rivera",  status: "No Answer",     next_follow_up: "2026-09-17" },
  { company_name: "EastLight Media",  full_name: "Kevin Osei",     mobile: "+1 555 561 3344", industry: "Marketing",  lead_source: "Cold Call", priority_level: "Warm", owner: "Natalie Wong",  status: "Try Again",     next_follow_up: "2026-09-19" },
];

const ASSIGNEES = ["James Carter", "Aisha Santos", "Derek Kim", "Natalie Wong", "Marco Rivera"];

// ─── Icons ────────────────────────────────────────────────────────────────────

function UploadCloudIcon() {
  return (
    <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#2FBEB3" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/>
      <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/>
    </svg>
  );
}

function CheckCircleIcon({ size = 20, color = "#16A34A" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
    </svg>
  );
}

function WarningIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
      <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <polyline points="6 9 12 15 18 9"/>
    </svg>
  );
}

function FileIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2FBEB3" strokeWidth="2" strokeLinecap="round">
      <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/>
    </svg>
  );
}

// ─── Shared primitives ────────────────────────────────────────────────────────

function SelectField({ value, options, onChange }: { value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <div className="relative inline-block w-full">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full appearance-none rounded-lg px-3 pr-8"
        style={{ height: 34, border: "1.5px solid #E3E7EF", fontSize: 12, color: "#111111", background: "#FFFFFF", outline: "none", cursor: "pointer" }}
      >
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
      <span className="absolute pointer-events-none" style={{ right: 8, top: "50%", transform: "translateY(-50%)", color: "#9CA3AF" }}>
        <ChevronDownIcon />
      </span>
    </div>
  );
}

function Btn({ children, variant = "primary", onClick, disabled }: {
  children: ReactNode;
  variant?: "primary" | "secondary" | "ghost";
  onClick?: () => void;
  disabled?: boolean;
}) {
  const styles: Record<string, CSSProperties> = {
    primary:   { background: "#2FBEB3", color: "#FFFFFF", border: "none" },
    secondary: { background: "#FFFFFF", color: "#0E7A70", border: "1.5px solid #0E7A70" },
    ghost:     { background: "transparent", color: "#6B7280", border: "none", textDecoration: "underline" },
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="rounded-lg font-semibold flex items-center gap-2"
      style={{ height: 38, paddingInline: variant === "ghost" ? 8 : 18, fontSize: 13, opacity: disabled ? 0.5 : 1, cursor: disabled ? "not-allowed" : "pointer", ...styles[variant] }}
      onMouseEnter={(e) => { if (!disabled && variant === "primary") (e.currentTarget as HTMLButtonElement).style.background = "#0E7A70"; }}
      onMouseLeave={(e) => { if (!disabled && variant === "primary") (e.currentTarget as HTMLButtonElement).style.background = "#2FBEB3"; }}
    >
      {children}
    </button>
  );
}

// ─── Step indicator ───────────────────────────────────────────────────────────

const STEP_LABELS = ["Upload", "Map Columns", "Preview & Confirm", "Done"];

function StepIndicator({ current }: { current: Step }) {
  return (
    <div className="flex items-center justify-center gap-0 mb-8">
      {STEP_LABELS.map((label, i) => {
        const num = (i + 1) as Step;
        const done = num < current;
        const active = num === current;
        const upcoming = num > current;

        return (
          <div key={label} className="flex items-center">
            {/* Connector */}
            {i > 0 && (
              <div style={{ width: 48, height: 2, background: done ? "#16A34A" : "#E3E7EF", marginInline: 4 }} />
            )}
            <div className="flex flex-col items-center gap-1.5">
              {/* Circle */}
              <div
                className="flex items-center justify-center rounded-full font-bold"
                style={{
                  width: 32, height: 32,
                  background: done ? "#16A34A" : active ? "#2FBEB3" : "#FFFFFF",
                  border: upcoming ? "2px solid #E3E7EF" : "none",
                  color: done || active ? "#FFFFFF" : "#9CA3AF",
                  fontSize: 13,
                  boxShadow: active ? "0 0 0 4px #2FBEB320" : "none",
                  transition: "all 200ms",
                }}
              >
                {done ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg> : num}
              </div>
              {/* Label */}
              <span style={{ fontSize: 11, fontWeight: active ? 700 : 500, color: active ? "#2FBEB3" : done ? "#16A34A" : "#9CA3AF", whiteSpace: "nowrap" }}>
                {label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Step 1: Upload ───────────────────────────────────────────────────────────

function Step1({ onNext }: { onNext: () => void }) {
  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState<string | null>(null);
  const [pasteMode, setPasteMode] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [assignee, setAssignee] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) setFile(f.name);
  };

  const simulateFile = () => setFile("leads_export_sep2026.csv");

  return (
    <div className="flex flex-col gap-6">
      {/* Assign all to */}
      <div className="flex items-center gap-3">
        <label style={{ fontSize: 13, fontWeight: 600, color: "#374151", whiteSpace: "nowrap" }}>Assign all leads to</label>
        <div style={{ width: 220 }}>
          <SelectField
            value={assignee}
            options={["— Unassigned —", ...ASSIGNEES]}
            onChange={setAssignee}
          />
        </div>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className="flex flex-col items-center justify-center gap-4 rounded-xl"
        style={{
          minHeight: 200,
          background: dragging ? "#CCF3EF" : file ? "#F0FDF4" : "#E3F7F5",
          border: `2px dashed ${dragging ? "#0E7A70" : file ? "#16A34A" : "#2FBEB3"}`,
          padding: "36px 24px",
          transition: "all 160ms",
          cursor: "pointer",
        }}
        onClick={() => !file && fileRef.current?.click()}
      >
        {file ? (
          <>
            <div className="flex items-center gap-3 rounded-lg px-4 py-3" style={{ background: "#FFFFFF", border: "1px solid #BBF7D0" }}>
              <FileIcon />
              <span style={{ fontSize: 14, fontWeight: 600, color: "#111111" }}>{file}</span>
              <button
                onClick={(e) => { e.stopPropagation(); setFile(null); }}
                style={{ fontSize: 11, color: "#DC2626", marginLeft: 8, fontWeight: 600 }}
              >
                Remove
              </button>
            </div>
            <span style={{ fontSize: 12, color: "#16A34A", fontWeight: 600 }}>File ready to process</span>
          </>
        ) : (
          <>
            <UploadCloudIcon />
            <div className="text-center">
              <p style={{ fontSize: 15, fontWeight: 600, color: "#0E7A70" }}>Drag & drop your Excel or CSV file here</p>
              <p style={{ fontSize: 12, color: "#6B7280", marginTop: 4 }}>Supported formats: .xlsx, .xls, .csv</p>
            </div>
            <Btn onClick={() => { simulateFile(); }}>Browse Files</Btn>
          </>
        )}
        <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={(e) => { if (e.target.files?.[0]) setFile(e.target.files[0].name); }} />
      </div>

      {/* Divider */}
      <div className="flex items-center gap-3">
        <div style={{ flex: 1, height: 1, background: "#E3E7EF" }} />
        <span style={{ fontSize: 12, fontWeight: 600, color: "#9CA3AF" }}>OR</span>
        <div style={{ flex: 1, height: 1, background: "#E3E7EF" }} />
      </div>

      {/* Paste Data */}
      <div>
        <button
          className="flex items-center gap-2 font-semibold mb-3"
          style={{ fontSize: 13, color: pasteMode ? "#0E7A70" : "#2FBEB3" }}
          onClick={() => setPasteMode((v) => !v)}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points={pasteMode ? "18 15 12 9 6 15" : "6 9 12 15 18 9"}/></svg>
          Paste Data
        </button>

        {pasteMode && (
          <div className="flex flex-col gap-3">
            <textarea
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder={"Paste tab or pipe-separated data here…\nExample: Company\tContact\tPhone\nMeridian Corp\tSarah Blake\t+1 555 340 9921"}
              rows={5}
              className="w-full rounded-lg px-3 py-2.5 resize-none"
              style={{ border: "1.5px solid #E3E7EF", fontSize: 12, color: "#111111", lineHeight: 1.6, outline: "none", fontFamily: "monospace" }}
              onFocus={(e) => { e.currentTarget.style.borderColor = "#2FBEB3"; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = "#E3E7EF"; }}
            />
            <div className="flex justify-end">
              <Btn variant="secondary" onClick={() => setPasteText("Company\tContact\tPhone\tIndustry\nApex Dynamics\tOliver Chen\t+1 555 210 4491\tSaaS")}>
                Parse Pasted Data
              </Btn>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex justify-end pt-2" style={{ borderTop: "1px solid #E3E7EF" }}>
        <Btn onClick={onNext} disabled={!file && !pasteText}>
          Continue to Map Columns →
        </Btn>
      </div>
    </div>
  );
}

// ─── Step 2: Map Columns ──────────────────────────────────────────────────────

function Step2({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  const [mappings, setMappings] = useState<ColumnMapping[]>(
    SAMPLE_SOURCE_HEADERS.map((h) => {
      const m = AUTO_MAPPINGS[h];
      return { sourceHeader: h, targetField: m?.field ?? "— Ignore field —", confidence: m?.confidence ?? "ignored" };
    })
  );

  const setField = (idx: number, field: string) => {
    setMappings((prev) => prev.map((m, i) => i === idx ? { ...m, targetField: field, confidence: field === "— Ignore field —" ? "ignored" : m.confidence } : m));
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h3 style={{ fontSize: 15, fontWeight: 700, color: "#111111", marginBottom: 4 }}>Map Your Columns</h3>
        <p style={{ fontSize: 13, color: "#6B7280" }}>Match each column from your file to a DocLink field. Auto-detected mappings are pre-filled.</p>
      </div>

      {/* Header row */}
      <div className="grid gap-x-4 px-3 pb-2" style={{ gridTemplateColumns: "1fr 24px 1fr 120px", borderBottom: "1px solid #E3E7EF" }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.06em" }}>Source Column</span>
        <span />
        <span style={{ fontSize: 11, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.06em" }}>DocLink Field</span>
        <span style={{ fontSize: 11, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.06em" }}>Status</span>
      </div>

      {/* Mapping rows */}
      <div className="flex flex-col gap-2">
        {mappings.map((m, i) => (
          <div
            key={m.sourceHeader}
            className="grid items-center gap-x-4 rounded-lg px-3 py-2.5"
            style={{ gridTemplateColumns: "1fr 24px 1fr 120px", background: m.confidence === "confirm" ? "#FFFBEB" : "#FAFAFA", border: `1px solid ${m.confidence === "confirm" ? "#FDE68A" : "#F3F4F6"}` }}
          >
            {/* Source chip */}
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-md font-mono" style={{ fontSize: 12, background: "#F1F5F9", color: "#374151", border: "1px solid #E3E7EF" }}>
                {m.sourceHeader}
              </span>
            </div>

            {/* Arrow */}
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#D1D5DB" strokeWidth="2" strokeLinecap="round">
              <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
            </svg>

            {/* Target dropdown */}
            <SelectField value={m.targetField} options={DOCLINK_FIELDS} onChange={(v) => setField(i, v)} />

            {/* Confidence tag */}
            {m.confidence === "auto" && (
              <span className="flex items-center gap-1 rounded-full px-2.5 py-1 w-fit" style={{ fontSize: 11, fontWeight: 700, background: "#DCFCE7", color: "#16A34A" }}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                Auto-detected
              </span>
            )}
            {m.confidence === "confirm" && (
              <span className="flex items-center gap-1 rounded-full px-2.5 py-1 w-fit" style={{ fontSize: 11, fontWeight: 700, background: "#FEF3C7", color: "#B45309" }}>
                <WarningIcon size={10} />
                Please confirm
              </span>
            )}
            {m.confidence === "ignored" && (
              <span style={{ fontSize: 11, color: "#9CA3AF" }}>Ignored</span>
            )}
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-2" style={{ borderTop: "1px solid #E3E7EF" }}>
        <Btn variant="secondary" onClick={onBack}>← Back</Btn>
        <Btn onClick={onNext}>Continue to Preview →</Btn>
      </div>
    </div>
  );
}

// ─── Step 3: Preview & Confirm ────────────────────────────────────────────────

function Step3({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  const [dupAction, setDupAction] = useState<DuplicateAction>("skip");
  const totalLeads = 142;
  const duplicates = 12;

  const mappedHeaders: { key: keyof typeof PREVIEW_ROWS[0]; label: string }[] = [
    { key: "company_name",   label: "Company" },
    { key: "full_name",      label: "Contact" },
    { key: "mobile",         label: "Phone" },
    { key: "industry",       label: "Niche" },
    { key: "lead_source",    label: "Source" },
    { key: "priority_level", label: "Priority" },
    { key: "owner",          label: "Assignee" },
    { key: "status",         label: "Stage" },
  ];

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h3 style={{ fontSize: 15, fontWeight: 700, color: "#111111", marginBottom: 4 }}>Preview & Confirm</h3>
        <p style={{ fontSize: 13, color: "#6B7280" }}>Showing first 5 rows. Review before importing.</p>
      </div>

      {/* Duplicate warning */}
      <div className="flex flex-col gap-3 rounded-xl px-4 py-4" style={{ background: "#FFFBEB", border: "1.5px solid #FDE68A" }}>
        <div className="flex items-start gap-3">
          <span style={{ color: "#D97706", flexShrink: 0, marginTop: 1 }}><WarningIcon size={18} /></span>
          <div>
            <p style={{ fontSize: 13, fontWeight: 700, color: "#92400E" }}>
              {duplicates} potential duplicates found (matching company + phone)
            </p>
            <p style={{ fontSize: 12, color: "#B45309", marginTop: 2 }}>
              These records already exist in your pipeline. Choose how to handle them:
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-2 pl-7">
          {([["skip", "Skip duplicates — don't re-import existing leads"], ["import", "Import anyway — create new records"]] as const).map(([val, label]) => (
            <label key={val} className="flex items-center gap-2.5 cursor-pointer">
              <div
                onClick={() => setDupAction(val)}
                className="flex items-center justify-center rounded-full"
                style={{ width: 18, height: 18, border: `2px solid ${dupAction === val ? "#2FBEB3" : "#D1D5DB"}`, background: dupAction === val ? "#2FBEB3" : "#FFFFFF", flexShrink: 0, transition: "all 140ms" }}
              >
                {dupAction === val && <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#FFFFFF" }} />}
              </div>
              <span style={{ fontSize: 13, color: "#374151" }}>{label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Preview table */}
      <div className="rounded-lg overflow-hidden" style={{ border: "1px solid #E3E7EF" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "auto", minWidth: 700 }}>
            <thead>
              <tr style={{ background: "#F9FAFB", borderBottom: "1px solid #E3E7EF" }}>
                {mappedHeaders.map((h) => (
                  <th key={h.key} className="text-left px-3 py-2.5" style={{ fontSize: 11, fontWeight: 700, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.06em", whiteSpace: "nowrap" }}>
                    {h.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PREVIEW_ROWS.map((row, i) => (
                <tr key={i} style={{ borderBottom: i < PREVIEW_ROWS.length - 1 ? "1px solid #F3F4F6" : "none" }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = "#E3F7F5"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = "transparent"; }}
                >
                  {mappedHeaders.map((h) => (
                    <td key={h.key} className="px-3 py-2.5" style={{ fontSize: 12, color: "#374151", whiteSpace: "nowrap" }}>
                      {h.key === "priority_level" ? (
                        <span style={{ color: row[h.key] === "Hot" ? "#EF4444" : row[h.key] === "Warm" ? "#F59E0B" : "#3B82F6", fontWeight: 600, fontSize: 11 }}>
                          ● {row[h.key]}
                        </span>
                      ) : h.key === "status" ? (
                        <span className="px-2 py-0.5 rounded-full" style={{ fontSize: 11, fontWeight: 600, background: "#F1F5F9", color: "#64748B" }}>{row[h.key]}</span>
                      ) : row[h.key]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-3 py-2" style={{ background: "#F9FAFB", borderTop: "1px solid #E3E7EF" }}>
          <span style={{ fontSize: 11, color: "#9CA3AF" }}>Showing 5 of {totalLeads} rows</span>
        </div>
      </div>

      {/* Summary strip */}
      <div className="flex items-center gap-3 rounded-lg px-4 py-3" style={{ background: "#E3F7F5", border: "1px solid #A7F3D0" }}>
        <CheckCircleIcon size={16} />
        <p style={{ fontSize: 13, color: "#0E7A70", fontWeight: 500 }}>
          <strong>{dupAction === "skip" ? totalLeads - duplicates : totalLeads} leads</strong> ready to import · All will start at <strong>"New Lead"</strong> stage.
          {dupAction === "skip" && <span style={{ color: "#B45309", marginLeft: 6 }}>{duplicates} duplicates will be skipped.</span>}
        </p>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-2" style={{ borderTop: "1px solid #E3E7EF" }}>
        <Btn variant="secondary" onClick={onBack}>← Back</Btn>
        <Btn onClick={onNext}>Confirm Import →</Btn>
      </div>
    </div>
  );
}

// ─── Step 4: Done ─────────────────────────────────────────────────────────────

function Step4({ onRestart, onViewPipeline }: { onRestart: () => void; onViewPipeline: () => void }) {
  const stats = [
    { label: "Imported",          value: 130, bg: "#DCFCE7", color: "#16A34A", valueBg: "#16A34A" },
    { label: "Skipped Duplicates", value: 12,  bg: "#FEF3C7", color: "#B45309", valueBg: "#D97706" },
    { label: "Failed Rows",        value: 0,   bg: "#FEE2E2", color: "#DC2626", valueBg: "#DC2626" },
  ];

  return (
    <div className="flex flex-col items-center gap-8 py-6">
      {/* Success icon */}
      <div style={{ position: "relative" }}>
        <div
          className="flex items-center justify-center rounded-full"
          style={{ width: 72, height: 72, background: "#DCFCE7", boxShadow: "0 0 0 12px #DCFCE740" }}
        >
          <CheckCircleIcon size={36} />
        </div>
      </div>

      {/* Heading */}
      <div className="text-center">
        <h2 style={{ fontSize: 22, fontWeight: 700, color: "#111111", marginBottom: 6 }}>Import Complete</h2>
        <p style={{ fontSize: 14, color: "#6B7280" }}>Your leads have been added to the pipeline.</p>
      </div>

      {/* Stat tiles */}
      <div className="flex items-stretch gap-4 w-full" style={{ maxWidth: 480 }}>
        {stats.map((s) => (
          <div
            key={s.label}
            className="flex-1 flex flex-col items-center gap-2 rounded-xl py-5"
            style={{ background: s.bg, border: `1.5px solid ${s.color}30` }}
          >
            <span style={{ fontSize: 32, fontWeight: 800, color: s.valueBg, lineHeight: 1 }}>{s.value}</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: s.color }}>{s.label}</span>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex flex-col items-center gap-3">
        <Btn onClick={onViewPipeline}>View in Pipeline</Btn>
        <button
          onClick={onRestart}
          style={{ fontSize: 13, color: "#2FBEB3", fontWeight: 600, background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}
        >
          Import Another File
        </button>
      </div>
    </div>
  );
}

// ─── Root component ───────────────────────────────────────────────────────────

interface BulkImportProps {
  role: UserRole;
  initialStep?: Step;
  onNavigate?: (page: string) => void;
}

export function BulkImport({ initialStep = 1, onNavigate }: BulkImportProps) {
  const [step, setStep] = useState<Step>(initialStep);

  return (
    <div
      className="flex flex-col items-center"
      style={{ minHeight: "calc(100vh - 64px)", background: "#F9FAFB", padding: "36px 24px 60px" }}
    >
      <div
        className="w-full flex flex-col"
        style={{ maxWidth: 860, background: "#FFFFFF", borderRadius: 12, border: "1px solid #E3E7EF", boxShadow: "0 2px 12px rgba(15,27,60,0.07)", padding: "36px 40px" }}
      >
        {/* Page title */}
        <div className="mb-6">
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "#111111" }}>Bulk Import Leads</h1>
          <p style={{ fontSize: 13, color: "#6B7280", marginTop: 3 }}>Upload a file or paste data to import multiple leads at once.</p>
        </div>

        {/* Step indicator */}
        <StepIndicator current={step} />

        {/* Step content */}
        {step === 1 && <Step1 onNext={() => setStep(2)} />}
        {step === 2 && <Step2 onNext={() => setStep(3)} onBack={() => setStep(1)} />}
        {step === 3 && <Step3 onNext={() => setStep(4)} onBack={() => setStep(2)} />}
        {step === 4 && (
          <Step4
            onRestart={() => setStep(1)}
            onViewPipeline={() => onNavigate?.("pipeline-list")}
          />
        )}
      </div>
    </div>
  );
}

export default BulkImport;
