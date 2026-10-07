"use client";

import { useState, useRef, useEffect, useMemo, type ReactNode, type CSSProperties, type DragEvent, type Dispatch, type SetStateAction } from "react";
import * as XLSX from "xlsx";
import type { UserRole } from "@/lib/types";
import { REVENUE_CURRENCIES, type RevenueCurrency } from "@/lib/lead-custom-fields";
import { isSensitiveField, readDraft, useFormDraft } from "@/lib/use-form-draft";
import { notifyCrmDataChanged } from "@/lib/crm-invalidation";

// ─── Types ────────────────────────────────────────────────────────────────────

type Step = 1 | 2 | 3 | 4;
type DuplicateAction = "skip" | "import";
type ImportRow = Record<string, string>;

interface ColumnMapping {
  sourceHeader: string;
  targetField: string;
  confidence: "auto" | "confirm" | "manual" | "ignored";
}

interface ImportResult {
  imported: number;
  skipped: number;
  failed: number;
  failedRows: Array<{ row: number; error: string }>;
}

interface UploadState {
  fileName: string | null;
  pasteMode: boolean;
  pasteText: string;
  assignee: string;
  rows: ImportRow[];
}

interface BulkImportDraft {
  step: Step;
  upload: Omit<UploadState, "rows"> & { rows: ImportRow[] | null };
  rows: ImportRow[];
  mappings: ColumnMapping[];
  assigneeName: string;
  revenueCurrency: RevenueCurrency;
  duplicateAction: DuplicateAction;
}

const BULK_IMPORT_DRAFT_KEY = "leads:bulk-import";

const EMPTY_UPLOAD: UploadState = { fileName: null, pasteMode: false, pasteText: "", assignee: "", rows: [] };

function isBlankImport(draft: BulkImportDraft) {
  if (draft.step === 4) return true;
  return draft.step === 1 && !draft.upload.fileName && !draft.upload.pasteText.trim() && !draft.upload.rows?.length && draft.rows.length === 0;
}

function hasSensitiveColumn(pasteText: string) {
  const header = pasteText.split(/\r?\n/).find((line) => line.trim()) ?? "";
  return header.split(/[\t|,]/).some((column) => isSensitiveField(column));
}

// ─── Constants ────────────────────────────────────────────────────────────────

const IGNORE_FIELD = "— Ignore field —";

const DOCLINK_FIELDS = [
  "Company", "Contact Name", "Phone", "Niche", "Source",
  "Priority", "Assignee", "Stage", "Follow-up Date", "Notes",
  "Monthly Revenue", "Discovery Call", "Proposal Sent", IGNORE_FIELD,
];

// Aliases are compared against headers lowercased with non-alphanumerics removed.
// `exact` matches are marked auto-detected; `partial` (substring) matches ask for
// confirmation and are tried in this array's order, so more specific fields come first.
const FIELD_ALIASES: Array<{ field: string; exact: string[]; partial: string[] }> = [
  { field: "Discovery Call", exact: ["discoverycall", "discovery", "discoverycalldone", "discoverycallcompleted", "democall", "demodone"], partial: ["discovery", "democall"] },
  { field: "Proposal Sent", exact: ["proposalsent", "proposal", "proposalsubmitted", "proposalshared", "quotesent", "quotationsent"], partial: ["proposal", "quotation"] },
  { field: "Follow-up Date", exact: ["followupdate", "followup", "nextfollowup", "nextfollowupdate", "followupon", "callbackdate", "callback", "nextcall", "nextcalldate", "reminderdate", "reminder"], partial: ["followup", "callback", "reminder", "nextcall"] },
  { field: "Monthly Revenue", exact: ["monthlyrevenue", "revenue", "mrr", "monthlyincome", "income", "turnover", "monthlyturnover", "monthlysales", "revenuepermonth"], partial: ["revenue", "mrr", "turnover", "income"] },
  { field: "Phone", exact: ["phone", "phonenumber", "phoneno", "mobile", "mobilenumber", "mobileno", "mob", "contactnumber", "contactno", "cell", "cellphone", "cellnumber", "telephone", "tel", "whatsapp", "whatsappnumber", "whatsappno", "number"], partial: ["phone", "mobile", "whatsapp", "contactno", "contactnumber", "number"] },
  { field: "Assignee", exact: ["assignee", "assignedto", "assigned", "owner", "leadowner", "salesrep", "rep", "agent", "executive", "salesperson", "salesexecutive", "handledby", "accountmanager"], partial: ["assign", "salesrep", "handledby"] },
  { field: "Source", exact: ["source", "leadsource", "channel", "origin", "medium", "referral", "referredby", "campaign"], partial: ["source", "channel", "referr"] },
  { field: "Stage", exact: ["stage", "status", "leadstatus", "pipelinestage", "dealstage", "leadstage"], partial: ["stage", "status"] },
  { field: "Priority", exact: ["priority", "prioritylevel", "temperature", "leadtemperature", "heat", "rating"], partial: ["priority", "temperature"] },
  { field: "Niche", exact: ["niche", "industry", "category", "specialty", "speciality", "specialization", "specialisation", "segment", "vertical", "sector", "businesstype", "type"], partial: ["niche", "industry", "special", "category", "sector", "segment"] },
  { field: "Notes", exact: ["notes", "note", "remarks", "remark", "comments", "comment", "description", "details"], partial: ["note", "remark", "comment", "description"] },
  { field: "Company", exact: ["company", "companyname", "business", "businessname", "organization", "organisation", "organizationname", "organisationname", "org", "firm", "firmname", "clinic", "clinicname", "hospital", "hospitalname", "account", "accountname", "brand", "brandname", "practice", "practicename"], partial: ["company", "business", "organi", "clinic", "hospital", "firm", "practice"] },
  { field: "Contact Name", exact: ["contact", "contactname", "contactperson", "name", "fullname", "personname", "customername", "clientname", "leadname", "doctor", "doctorname", "drname", "firstname"], partial: ["contact", "person", "doctor", "name"] },
];

function normalizeHeader(header: string) {
  return header.toLowerCase().replace(/\s*\(\d+\)$/, "").replace(/[^a-z0-9]/g, "");
}

function autoMapColumns(headers: string[]): ColumnMapping[] {
  const normalized = headers.map(normalizeHeader);
  const mapped: Array<ColumnMapping | undefined> = headers.map(() => undefined);
  const usedFields = new Set<string>();

  for (const { field, exact } of FIELD_ALIASES) {
    const index = normalized.findIndex((header, i) => !mapped[i] && exact.includes(header));
    if (index === -1) continue;
    mapped[index] = { sourceHeader: headers[index], targetField: field, confidence: "auto" };
    usedFields.add(field);
  }

  for (const { field, partial } of FIELD_ALIASES) {
    if (usedFields.has(field)) continue;
    const index = normalized.findIndex((header, i) => !mapped[i] && partial.some((keyword) => header.includes(keyword)));
    if (index === -1) continue;
    mapped[index] = { sourceHeader: headers[index], targetField: field, confidence: "confirm" };
    usedFields.add(field);
  }

  return headers.map((header, i) => mapped[i] ?? { sourceHeader: header, targetField: IGNORE_FIELD, confidence: "ignored" });
}

function parseDelimitedText(value: string) {
  const lines = value.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) return { headers: [], rows: [] as ImportRow[] };
  const delimiter = lines[0].includes("\t") ? "\t" : lines[0].includes("|") ? "|" : ",";
  const parseLine = (line: string) => {
    const values: string[] = [];
    let current = "";
    let quoted = false;
    for (let index = 0; index < line.length; index += 1) {
      const character = line[index];
      if (character === '"' && line[index + 1] === '"') { current += '"'; index += 1; }
      else if (character === '"') quoted = !quoted;
      else if (character === delimiter && !quoted) { values.push(current.trim()); current = ""; }
      else current += character;
    }
    values.push(current.trim());
    return values;
  };
  const headers = uniqueHeaders(parseLine(lines[0]));
  const rows = lines.slice(1).map((line) => {
    const values = parseLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));
  });
  return { headers, rows };
}

function uniqueHeaders(headers: string[]) {
  const counts = new Map<string, number>();
  return headers.map((header, index) => {
    const base = header.trim() || `Column ${index + 1}`;
    const count = counts.get(base) ?? 0;
    counts.set(base, count + 1);
    return count === 0 ? base : `${base} (${count + 1})`;
  });
}

function parseSpreadsheet(buffer: ArrayBuffer) {
  const workbook = XLSX.read(buffer, { type: "array", raw: true, dateNF: "yyyy-mm-dd" });
  const worksheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!worksheet) return [] as ImportRow[];

  const table = XLSX.utils.sheet_to_json<Array<string | number | boolean | null>>(worksheet, {
    header: 1,
    defval: "",
    raw: false,
    dateNF: "yyyy-mm-dd",
  });
  const headerIndex = table.findIndex((row) => row.some((value) => String(value ?? "").trim()));
  if (headerIndex === -1) return [] as ImportRow[];
  const headers = uniqueHeaders(table[headerIndex].map((value) => String(value ?? "")));
  return table.slice(headerIndex + 1)
    .filter((row) => row.some((value) => String(value).trim()))
    .map((row) => Object.fromEntries(headers.map((header, index) => [header, String(row[index] ?? "").trim()])));
}

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

function Step1({ upload, onUploadChange, onNext }: {
  upload: UploadState;
  onUploadChange: Dispatch<SetStateAction<UploadState>>;
  onNext: (rows: ImportRow[], assigneeName: string) => void;
}) {
  const { fileName: file, pasteMode, pasteText, assignee, rows } = upload;
  const update = (patch: Partial<UploadState>) => onUploadChange((prev) => ({ ...prev, ...patch }));
  const [dragging, setDragging] = useState(false);
  const [assignees, setAssignees] = useState<string[]>([]);
  const [fileError, setFileError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const loadAssignees = async () => {
      try {
        const response = await fetch("/api/users");
        const result = await response.json() as { users?: Array<{ name: string; status: string }> };
        if (!response.ok) return;
        const activeUsers = (result.users ?? []).filter((user) => user.status === "active").map((user) => user.name);
        setAssignees(activeUsers);
        if (activeUsers.length > 0) onUploadChange((prev) => (prev.assignee ? prev : { ...prev, assignee: activeUsers[0] }));
      } catch {
        // The import API will return the actionable authentication/configuration error.
      }
    };
    void loadAssignees();
  }, [onUploadChange]);

  const readFile = async (file: File) => {
    setFileError("");
    update({ fileName: file.name });
    try {
      const parsedRows = parseSpreadsheet(await file.arrayBuffer());
      update({ rows: parsedRows });
      if (parsedRows.length === 0) setFileError("No data rows were found in this file.");
    } catch {
      update({ rows: [] });
      setFileError("This file could not be read. Please upload a valid CSV or Excel file.");
    }
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) void readFile(f);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Assign all to */}
      <div className="flex items-center gap-3">
        <label style={{ fontSize: 13, fontWeight: 600, color: "#374151", whiteSpace: "nowrap" }}>Assign all leads to</label>
        <div style={{ width: 220 }}>
          <SelectField
            value={assignee}
            options={assignees}
            onChange={(value) => update({ assignee: value })}
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
                onClick={(e) => { e.stopPropagation(); update({ fileName: null, rows: [] }); setFileError(""); }}
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
            <Btn onClick={() => fileRef.current?.click()}>Browse Files</Btn>
          </>
        )}
        <input ref={fileRef} type="file" accept=".csv,.tsv,.xlsx,.xls" className="hidden" onChange={(e) => { if (e.target.files?.[0]) void readFile(e.target.files[0]); }} />
      </div>
      {fileError && <p role="alert" style={{ fontSize: 12, color: "#DC2626" }}>{fileError}</p>}

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
          onClick={() => update({ pasteMode: !pasteMode })}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points={pasteMode ? "18 15 12 9 6 15" : "6 9 12 15 18 9"}/></svg>
          Paste Data
        </button>

        {pasteMode && (
          <div className="flex flex-col gap-3">
            <textarea
              value={pasteText}
              onChange={(e) => update({ pasteText: e.target.value })}
              placeholder={"Paste tab or pipe-separated data here…\nExample: Company\tContact\tPhone\nMeridian Corp\tSarah Blake\t+1 555 340 9921"}
              rows={5}
              className="w-full rounded-lg px-3 py-2.5 resize-none"
              style={{ border: "1.5px solid #E3E7EF", fontSize: 12, color: "#111111", lineHeight: 1.6, outline: "none", fontFamily: "monospace" }}
              onFocus={(e) => { e.currentTarget.style.borderColor = "#2FBEB3"; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = "#E3E7EF"; }}
            />
            <div className="flex justify-end">
              <Btn variant="secondary" onClick={() => {
                const parsed = parseDelimitedText(pasteText);
                update({ rows: parsed.rows });
              }}>
                Parse Pasted Data
              </Btn>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex justify-end pt-2" style={{ borderTop: "1px solid #E3E7EF" }}>
        <Btn onClick={() => {
          const parsed = rows.length > 0 ? { rows } : parseDelimitedText(pasteText);
          onNext(parsed.rows, assignee === "— Unassigned —" ? "" : assignee);
        }} disabled={rows.length === 0 && parseDelimitedText(pasteText).rows.length === 0}>
          Continue to Map Columns →
        </Btn>
      </div>
    </div>
  );
}

// ─── Step 2: Map Columns ──────────────────────────────────────────────────────

function Step2({ rows, mappings: currentMappings, onMappingsChange: setMappings, revenueCurrency, onRevenueCurrencyChange, onNext, onBack }: {
  rows: ImportRow[];
  mappings: ColumnMapping[];
  onMappingsChange: (mappings: ColumnMapping[]) => void;
  revenueCurrency: RevenueCurrency;
  onRevenueCurrencyChange: (currency: RevenueCurrency) => void;
  onNext: (mappings: ColumnMapping[]) => void;
  onBack: () => void;
}) {
  const sourceHeaders = Object.keys(rows[0] ?? {});
  const sameHeaders = currentMappings.length === sourceHeaders.length
    && currentMappings.every((mapping, i) => mapping.sourceHeader === sourceHeaders[i]);
  const mappings = sameHeaders ? currentMappings : autoMapColumns(sourceHeaders);
  const companyMapped = mappings.some((m) => m.targetField === "Company");
  const revenueMapped = mappings.some((m) => m.targetField === "Monthly Revenue");

  const setField = (idx: number, field: string) => {
    setMappings(mappings.map((m, i) => {
      if (i === idx) return { ...m, targetField: field, confidence: field === IGNORE_FIELD ? "ignored" : "manual" };
      if (field !== IGNORE_FIELD && m.targetField === field) return { ...m, targetField: IGNORE_FIELD, confidence: "ignored" };
      return m;
    }));
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
            {m.confidence === "manual" && (
              <span className="flex items-center gap-1 rounded-full px-2.5 py-1 w-fit" style={{ fontSize: 11, fontWeight: 700, background: "#E3F7F5", color: "#0E7A70" }}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                Mapped
              </span>
            )}
            {m.confidence === "ignored" && (
              <span style={{ fontSize: 11, color: "#9CA3AF" }}>Ignored</span>
            )}
          </div>
        ))}
      </div>

      {revenueMapped && (
        <div className="flex items-center gap-3 rounded-lg px-3 py-2.5" style={{ background: "#F9FAFB", border: "1px solid #E3E7EF" }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>Monthly revenue currency</span>
          <div style={{ width: 90 }}>
            <SelectField
              value={revenueCurrency}
              options={[...REVENUE_CURRENCIES]}
              onChange={(value) => onRevenueCurrencyChange(value as RevenueCurrency)}
            />
          </div>
          <span style={{ fontSize: 12, color: "#6B7280" }}>Used when a cell has no LKR or $ symbol.</span>
        </div>
      )}

      {!companyMapped && (
        <p role="alert" className="flex items-center gap-2" style={{ fontSize: 12, color: "#DC2626" }}>
          <WarningIcon size={14} />
          Map one of your columns to the Company field — it is required for every lead.
        </p>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-2" style={{ borderTop: "1px solid #E3E7EF" }}>
        <Btn variant="secondary" onClick={onBack}>← Back</Btn>
        <Btn onClick={() => onNext(mappings)} disabled={!companyMapped}>Continue to Preview →</Btn>
      </div>
    </div>
  );
}

// ─── Step 3: Preview & Confirm ────────────────────────────────────────────────

function Step3({ rows, mappings, assigneeName, revenueCurrency, dupAction, onDupActionChange: setDupAction, onNext, onBack }: {
  rows: ImportRow[];
  mappings: ColumnMapping[];
  assigneeName: string;
  revenueCurrency: RevenueCurrency;
  dupAction: DuplicateAction;
  onDupActionChange: (action: DuplicateAction) => void;
  onNext: (result: ImportResult) => void;
  onBack: () => void;
}) {
  const [duplicates, setDuplicates] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const totalLeads = rows.length;
  const previewRows = rows.slice(0, 5);

  const mappedHeaders = mappings
    .filter((mapping) => mapping.targetField !== IGNORE_FIELD)
    .map((mapping) => ({ key: mapping.sourceHeader, label: mapping.targetField }));

  useEffect(() => {
    const findDuplicates = async () => {
      try {
        const response = await fetch("/api/leads");
        if (!response.ok) return;
        const result = await response.json() as { leads?: Array<{ company: string; phone: string }> };
        const existing = new Set((result.leads ?? []).map((lead) => `${(lead.company ?? "").trim().toLowerCase()}|${lead.phone ?? ""}`));
        const companyHeader = mappings.find((mapping) => mapping.targetField === "Company")?.sourceHeader;
        const phoneHeader = mappings.find((mapping) => mapping.targetField === "Phone")?.sourceHeader;
        if (!companyHeader || !phoneHeader) return;
        setDuplicates(rows.filter((row) => {
          const phone = (row[phoneHeader] ?? "").trim();
          return phone && existing.has(`${(row[companyHeader] ?? "").trim().toLowerCase()}|${phone}`);
        }).length);
      } catch {
        // The duplicate count is informational; the import API still enforces duplicate handling.
      }
    };
    void findDuplicates();
  }, [mappings, rows]);

  const confirmImport = async () => {
    setError("");
    setSaving(true);
    try {
      const response = await fetch("/api/leads/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rows,
          mappings: mappings.map(({ sourceHeader, targetField }) => ({ sourceHeader, targetField })),
          duplicateAction: dupAction,
          assigneeName,
          revenueCurrency,
        }),
      });
      const result = await response.json().catch(() => ({})) as { imported?: number; skipped?: number; failedRows?: ImportResult["failedRows"]; error?: string };
      if (!response.ok) {
        setError(result.error ?? `Unable to import leads (server responded ${response.status}).`);
        return;
      }
      notifyCrmDataChanged("leads", "followups", "dashboard", "notifications");
      const failedRows = result.failedRows ?? [];
      onNext({ imported: result.imported ?? 0, skipped: result.skipped ?? 0, failed: failedRows.length, failedRows });
    } catch {
      setError("Unable to reach the server. Please try again.");
    } finally {
      setSaving(false);
    }
  };

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
              {previewRows.map((row, i) => (
                <tr key={i} style={{ borderBottom: i < previewRows.length - 1 ? "1px solid #F3F4F6" : "none" }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = "#E3F7F5"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = "transparent"; }}
                >
                  {mappedHeaders.map((h) => (
                    <td key={h.key} className="px-3 py-2.5" style={{ fontSize: 12, color: "#374151", whiteSpace: "nowrap" }}>
                      {row[h.key]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-3 py-2" style={{ background: "#F9FAFB", borderTop: "1px solid #E3E7EF" }}>
          <span style={{ fontSize: 11, color: "#9CA3AF" }}>Showing {previewRows.length} of {totalLeads} rows</span>
        </div>
      </div>

      {/* Summary strip */}
      <div className="flex items-center gap-3 rounded-lg px-4 py-3" style={{ background: "#E3F7F5", border: "1px solid #A7F3D0" }}>
        <CheckCircleIcon size={16} />
        <p style={{ fontSize: 13, color: "#0E7A70", fontWeight: 500 }}>
          <strong>{dupAction === "skip" ? totalLeads - duplicates : totalLeads} leads</strong> ready to import · All will start at <strong>&quot;New Lead&quot;</strong> stage.
          {dupAction === "skip" && <span style={{ color: "#B45309", marginLeft: 6 }}>{duplicates} duplicates will be skipped.</span>}
        </p>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-2" style={{ borderTop: "1px solid #E3E7EF" }}>
        <Btn variant="secondary" onClick={onBack}>← Back</Btn>
        {error && <p role="alert" style={{ fontSize: 12, color: "#DC2626" }}>{error}</p>}
        <Btn onClick={() => void confirmImport()} disabled={saving}>{saving ? "Importing..." : "Confirm Import →"}</Btn>
      </div>
    </div>
  );
}

// ─── Step 4: Done ─────────────────────────────────────────────────────────────

function Step4({ result, onRestart, onViewPipeline }: { result: ImportResult; onRestart: () => void; onViewPipeline: () => void }) {
  const stats = [
    { label: "Imported",          value: result.imported, bg: "#DCFCE7", color: "#16A34A", valueBg: "#16A34A" },
    { label: "Skipped Duplicates", value: result.skipped,  bg: "#FEF3C7", color: "#B45309", valueBg: "#D97706" },
    { label: "Failed Rows",        value: result.failed,   bg: "#FEE2E7", color: "#DC2626", valueBg: "#DC2626" },
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

      {result.failedRows.length > 0 && (
        <div className="w-full rounded-lg px-4 py-3" style={{ maxWidth: 480, background: "#FEF2F2", border: "1px solid #FECACA" }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: "#B91C1C", marginBottom: 6 }}>Rows that could not be imported</p>
          <ul className="flex flex-col gap-1">
            {result.failedRows.slice(0, 10).map((failure) => (
              <li key={failure.row} style={{ fontSize: 12, color: "#7F1D1D" }}>Row {failure.row}: {failure.error}</li>
            ))}
          </ul>
          {result.failedRows.length > 10 && (
            <p style={{ fontSize: 11, color: "#B91C1C", marginTop: 6 }}>…and {result.failedRows.length - 10} more</p>
          )}
        </div>
      )}

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
  const [restored] = useState(() => readDraft<BulkImportDraft>(BULK_IMPORT_DRAFT_KEY));
  const [step, setStep] = useState<Step>(() => (restored && restored.rows.length > 0 ? restored.step : initialStep));
  const [upload, setUpload] = useState<UploadState>(() => (
    restored ? { ...EMPTY_UPLOAD, ...restored.upload, rows: restored.upload.rows ?? restored.rows } : EMPTY_UPLOAD
  ));
  const [rows, setRows] = useState<ImportRow[]>(restored?.rows ?? []);
  const [mappings, setMappings] = useState<ColumnMapping[]>(restored?.mappings ?? []);
  const [assigneeName, setAssigneeName] = useState(restored?.assigneeName ?? "");
  const [revenueCurrency, setRevenueCurrency] = useState<RevenueCurrency>(restored?.revenueCurrency ?? "LKR");
  const [dupAction, setDupAction] = useState<DuplicateAction>(restored?.duplicateAction ?? "skip");
  const [result, setResult] = useState<ImportResult>({ imported: 0, skipped: 0, failed: 0, failedRows: [] });

  const draft = useMemo<BulkImportDraft>(() => ({
    step,
    upload: {
      ...upload,
      pasteText: hasSensitiveColumn(upload.pasteText) ? "" : upload.pasteText,
      rows: upload.rows === rows ? null : upload.rows,
    },
    rows,
    mappings,
    assigneeName,
    revenueCurrency,
    duplicateAction: dupAction,
  }), [step, upload, rows, mappings, assigneeName, revenueCurrency, dupAction]);
  const clearDraft = useFormDraft(BULK_IMPORT_DRAFT_KEY, draft, { isEmpty: isBlankImport });

  const restart = () => {
    setUpload(EMPTY_UPLOAD);
    setRows([]);
    setMappings([]);
    setAssigneeName("");
    setDupAction("skip");
    setStep(1);
  };

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
        {step === 1 && <Step1 upload={upload} onUploadChange={setUpload} onNext={(nextRows, nextAssignee) => { setRows(nextRows); setMappings([]); setAssigneeName(nextAssignee); setStep(2); }} />}
        {step === 2 && <Step2 rows={rows} mappings={mappings} onMappingsChange={setMappings} revenueCurrency={revenueCurrency} onRevenueCurrencyChange={setRevenueCurrency} onNext={(nextMappings) => { setMappings(nextMappings); setStep(3); }} onBack={() => setStep(1)} />}
        {step === 3 && <Step3 rows={rows} mappings={mappings} assigneeName={assigneeName} revenueCurrency={revenueCurrency} dupAction={dupAction} onDupActionChange={setDupAction} onNext={(nextResult) => { clearDraft(); setResult(nextResult); setStep(4); }} onBack={() => setStep(2)} />}
        {step === 4 && (
          <Step4
            result={result}
            onRestart={restart}
            onViewPipeline={() => onNavigate?.("pipeline-list")}
          />
        )}
      </div>
    </div>
  );
}

export default BulkImport;
