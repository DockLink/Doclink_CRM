"use client";

import { useState, useRef, useEffect, type ReactNode, type CSSProperties } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { UserRole } from "@/lib/types";
import { assigneeColor, displayDate, displayTime, initials, type ApiLead, urgencyFor } from "@/lib/lead-ui";
import { activeStages, stageColor, type PipelineStage } from "@/lib/pipeline-stages";
import { usePipelineStages } from "@/lib/use-pipeline-stages";

// ─── Palette ──────────────────────────────────────────────────────────────────

const PRIORITY_COLOR = { hot: "#EF4444", warm: "#F59E0B", cold: "#3B82F6" } as const;

// ─── Types ────────────────────────────────────────────────────────────────────

type Priority = "hot" | "warm" | "cold";
type Urgency  = "overdue" | "today" | "upcoming" | "none";

interface ListLead {
  id: string;
  priority: Priority;
  company: string;
  niche: string;
  source: string;
  contact: string;
  phone: string;
  stage: string;
  followUpDate: string;
  followUpTime: string;
  daysInStage: number;
  calls: number;
  assigneeInitials: string;
  assigneeName: string;
  assigneeColor: string;
  urgency: Urgency;
  stale?: boolean;
}

interface AssignableUser {
  id: string;
  name: string;
  initials: string;
  color: string;
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function ChevronUpDownIcon({ dir }: { dir?: "up" | "down" }) {
  if (dir === "up")   return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#2FBEB3" strokeWidth="2.5" strokeLinecap="round"><polyline points="18 15 12 9 6 15"/></svg>;
  if (dir === "down") return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#2FBEB3" strokeWidth="2.5" strokeLinecap="round"><polyline points="6 9 12 15 18 9"/></svg>;
  return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round"><polyline points="18 15 12 9 6 15"/><polyline points="6 16 12 22 18 16" style={{display:"none"}}/><path d="M7 10l5-5 5 5M7 14l5 5 5-5" strokeWidth="1.5"/></svg>;
}

function CheckIcon() {
  return <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>;
}

function ChevronSmall({ open }: { open: boolean }) {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
      style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 0.15s" }}>
      <polyline points="6 9 12 15 18 9"/>
    </svg>
  );
}

function SearchIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" style={{color:"#9CA3AF"}}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>;
}

function XSmall() {
  return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;
}

function UploadIcon() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>;
}

function PlusIcon() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>;
}

function FilterBarIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{color:"#6B7280"}}><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>;
}

// ─── Filter pill dropdown ─────────────────────────────────────────────────────

function FilterPill({
  label,
  options,
  value,
  onChange,
  renderOption,
}: {
  label: string;
  options: string[];
  value: string | null;
  onChange: (v: string | null) => void;
  renderOption?: (o: string) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  const active = value !== null;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-medium transition-all"
        style={{
          background: active ? "#E3F7F5" : "#FFFFFF",
          border: `1px solid ${active ? "#2FBEB3" : "#E5E7EB"}`,
          color: active ? "#0E7A70" : "#374151",
          cursor: "pointer",
          outline: "none",
        }}
      >
        {active && value && renderOption ? renderOption(value) : null}
        <span>{active && value ? value : label}</span>
        {active ? (
          <span onClick={(e) => { e.stopPropagation(); onChange(null); }} style={{ color: "#0E7A70", display: "flex" }}>
            <XSmall />
          </span>
        ) : (
          <span style={{ color: "#9CA3AF" }}><ChevronSmall open={open} /></span>
        )}
      </button>

      {open && (
        <div
          className="absolute top-full mt-1 rounded-xl shadow-xl border py-1.5 z-50"
          style={{ background: "#FFFFFF", borderColor: "#E5E7EB", minWidth: 180, left: 0 }}
        >
          {options.map((opt) => (
            <button
              key={opt}
              onClick={() => { onChange(value === opt ? null : opt); setOpen(false); }}
              className="w-full flex items-center gap-2.5 px-3 text-left transition-colors"
              style={{ height: 34, background: "none", border: "none", cursor: "pointer", outline: "none" }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "#F9FAFB")}
              onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "transparent")}
            >
              {renderOption ? renderOption(opt) : null}
              <span style={{ fontSize: 13, color: "#374151", flex: 1 }}>{opt}</span>
              {value === opt && <CheckIcon />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Table header cell ────────────────────────────────────────────────────────

type SortDir = "up" | "down" | null;

function TH({
  children,
  sortable,
  sortDir,
  onClick,
  width,
  center,
}: {
  children: ReactNode;
  sortable?: boolean;
  sortDir?: SortDir;
  onClick?: () => void;
  width?: number | string;
  center?: boolean;
}) {
  return (
    <th
      onClick={sortable ? onClick : undefined}
      className={sortable ? "cursor-pointer select-none" : ""}
      style={{
        height: 40,
        padding: "0 12px",
        textAlign: center ? "center" : "left",
        fontSize: 11,
        fontWeight: 600,
        color: "#6B7280",
        letterSpacing: "0.05em",
        background: "#F9FAFB",
        borderBottom: "1px solid #E5E7EB",
        whiteSpace: "nowrap",
        width: width ?? "auto",
        userSelect: "none",
      }}
    >
      <div className={`flex items-center gap-1 ${center ? "justify-center" : ""}`}>
        <span>{typeof children === "string" ? children.toUpperCase() : children}</span>
        {sortable && <ChevronUpDownIcon dir={sortDir ?? undefined} />}
      </div>
    </th>
  );
}

// ─── Row left-border urgency ──────────────────────────────────────────────────

function rowStyles(lead: ListLead, selected: boolean): CSSProperties {
  const base: CSSProperties = {
    borderBottom: "1px solid #F3F4F6",
    height: 48,
    cursor: "pointer",
    transition: "background 0.1s",
  };
  if (selected)           return { ...base, background: "#E3F7F5" };
  if (lead.stale)         return { ...base, background: "#F1F5F9" };
  if (lead.urgency === "overdue") return { ...base, borderLeft: "3px solid #DC2626", background: "#FFF8F8" };
  if (lead.urgency === "today")   return { ...base, borderLeft: "3px solid #B45309", background: "#FFFBF0" };
  return { ...base, background: "#FFFFFF" };
}

// ─── Bulk action bar ──────────────────────────────────────────────────────────

function BulkActionBar({
  count,
  assignees,
  onCancel,
  onReassign,
  onDelete,
}: {
  count: number;
  assignees: AssignableUser[];
  onCancel: () => void;
  onReassign: (assigneeName: string) => void;
  onDelete: () => void;
}) {
  const [reassignOpen, setReassignOpen] = useState(false);
  const [assigneeName, setAssigneeName] = useState(assignees[0]?.name ?? "");

  useEffect(() => {
    setAssigneeName((current) => (
      current && assignees.some((assignee) => assignee.name === current) ? current : (assignees[0]?.name ?? "")
    ));
  }, [assignees]);

  return (
    <div className="relative">
      {reassignOpen && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            onReassign(assigneeName);
            setReassignOpen(false);
          }}
          className="flex items-end gap-3 rounded-xl shadow-xl px-4 py-3"
          style={{ position: "fixed", bottom: 88, left: "50%", transform: "translateX(-50%)", background: "#111111", border: "1px solid #2a2a2a", minWidth: 340, zIndex: 201 }}
        >
          <label className="flex flex-col gap-1.5 flex-1" style={{ fontSize: 11, color: "#9CA3AF" }}>
            Assign {count} lead{count !== 1 ? "s" : ""} to
            <select
              value={assigneeName}
              onChange={(event) => setAssigneeName(event.target.value)}
              autoFocus
              className="h-8 rounded-lg px-2 text-xs outline-none"
              style={{ background: "#1F2937", color: "#E5E7EB", border: "1px solid #374151" }}
            >
              {assignees.length === 0 && <option value="">No active users</option>}
              {assignees.map((assignee) => <option key={assignee.id} value={assignee.name}>{assignee.name}</option>)}
            </select>
          </label>
          <button type="button" onClick={() => setReassignOpen(false)} className="h-8 px-2 rounded-lg text-xs" style={{ background: "transparent", color: "#9CA3AF", border: "1px solid #374151", cursor: "pointer" }}>
            Cancel
          </button>
          <button type="submit" disabled={!assigneeName} className="h-8 px-3 rounded-lg text-xs font-medium" style={{ background: assigneeName ? "#2FBEB3" : "#6B7280", color: "#FFFFFF", border: "none", cursor: assigneeName ? "pointer" : "not-allowed" }}>
            Confirm
          </button>
        </form>
      )}
      <div
        className="flex items-center gap-3 px-5 py-0 rounded-xl shadow-xl"
        style={{
          position: "fixed",
          bottom: 32,
          left: "50%",
          transform: "translateX(-50%)",
          background: "#111111",
          height: 48,
          zIndex: 200,
          border: "1px solid #2a2a2a",
          minWidth: 380,
          pointerEvents: "auto",
        }}
      >
      <span style={{ fontSize: 13, fontWeight: 500, color: "#E5E7EB" }}>
        <span style={{ color: "#2FBEB3", fontWeight: 700 }}>{count}</span> lead{count !== 1 ? "s" : ""} selected
      </span>
      <div className="w-px self-stretch mx-1" style={{ background: "#333" }} />
      <button
        type="button"
        onClick={() => setReassignOpen(true)}
        className="flex items-center gap-1.5 px-3 h-8 rounded-lg text-xs font-medium transition-colors"
        style={{ background: "#1F2937", color: "#E5E7EB", border: "1px solid #374151", cursor: "pointer" }}
        onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "#374151")}
        onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "#1F2937")}
      >
        Reassign
      </button>
      <button
        type="button"
        onClick={onDelete}
        className="flex items-center gap-1.5 px-3 h-8 rounded-lg text-xs font-medium transition-colors"
        style={{ background: "transparent", color: "#FCA5A5", border: "1px solid #7F1D1D", cursor: "pointer" }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#450A0A"; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
      >
        Delete
      </button>
      <div className="flex-1" />
      <button
        type="button"
        onClick={onCancel}
        className="flex items-center gap-1 text-xs transition-opacity hover:opacity-70"
        style={{ background: "none", border: "none", cursor: "pointer", color: "#9CA3AF" }}
      >
        <XSmall /> Cancel
      </button>
      </div>
    </div>
  );
}

// ─── Top controls bar ─────────────────────────────────────────────────────────

function ListTopBar({ role }: { role: UserRole }) {
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
          const active = label === "List";
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
        className="flex items-center gap-1.5 px-3 h-9 rounded-lg text-sm font-medium hover:bg-[#F9FAFB] transition-colors"
        style={{ border: "1px solid #E5E7EB", background: "#FFFFFF", cursor: "pointer", color: "#374151" }}
      >
        <FilterBarIcon />
        Filter
      </button>
      {role === "superadmin" && (
        <Link
          href="/pipeline/bulk-import"
          className="flex items-center gap-1.5 px-3 h-9 rounded-lg text-sm font-medium"
          style={{ border: "1px solid #0E7A70", background: "#FFFFFF", color: "#0E7A70", textDecoration: "none" }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "#E3F7F5"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "#FFFFFF"; }}
        >
          <UploadIcon />Import Leads
        </Link>
      )}
      <Link
        href="/leads/new"
        className="flex items-center gap-1.5 px-3 h-9 rounded-lg text-sm font-semibold text-white"
        style={{ background: "#2FBEB3", textDecoration: "none" }}
        onMouseEnter={(e) => { e.currentTarget.style.background = "#0E7A70"; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = "#2FBEB3"; }}
      >
        <PlusIcon />Add Lead
      </Link>
    </div>
  );
}

// ─── Filter bar ───────────────────────────────────────────────────────────────

function FilterBar({
  filters,
  stages,
  assignees,
  setFilter,
  search,
  setSearch,
}: {
  filters: Record<string, string | null>;
  stages: PipelineStage[];
  assignees: AssignableUser[];
  setFilter: (key: string, val: string | null) => void;
  search: string;
  setSearch: (v: string) => void;
}) {
  const assigneeOptions = assignees.map((assignee) => assignee.name);
  const NICHES    = ["Enterprise SaaS", "Healthcare", "Agency", "Deep Tech", "Infrastructure", "Marketing", "Fintech", "Pharma", "Logistics", "Real Estate", "Consulting", "Investment", "SaaS", "Clean Energy", "Retail", "Media"];
  const PRIORITIES = ["hot", "warm", "cold"];
  const RANGES     = ["Today", "This week", "Next 7 days", "This month", "Overdue"];

  return (
    <div
      className="flex items-center gap-2 px-5 flex-wrap"
      style={{ minHeight: 52, background: "#FFFFFF", borderBottom: "1px solid #E5E7EB" }}
    >
      <FilterPill
        label="Stage" options={activeStages(stages).map((stage) => stage.name)} value={filters.stage ?? null}
        onChange={(v) => setFilter("stage", v)}
        renderOption={(o) => <div className="w-2 h-2 rounded-full shrink-0" style={{ background: stageColor(stages, o) }} />}
      />
      <FilterPill
        label="Assignee" options={assigneeOptions} value={filters.assignee ?? null}
        onChange={(v) => setFilter("assignee", v)}
      />
      <FilterPill
        label="Niche" options={NICHES} value={filters.niche ?? null}
        onChange={(v) => setFilter("niche", v)}
      />
      <FilterPill
        label="Priority" options={PRIORITIES} value={filters.priority ?? null}
        onChange={(v) => setFilter("priority", v)}
        renderOption={(o) => <div className="w-2 h-2 rounded-full shrink-0" style={{ background: PRIORITY_COLOR[o as Priority] }} />}
      />
      <FilterPill
        label="Date range" options={RANGES} value={filters.dateRange ?? null}
        onChange={(v) => setFilter("dateRange", v)}
      />
      <div className="flex-1 flex justify-end" style={{ minWidth: 200 }}>
        <div className="relative" style={{ width: 240 }}>
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"><SearchIcon /></span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search leads..."
            className="w-full h-8 pl-8 pr-3 rounded-lg border text-xs outline-none transition-all"
            style={{ borderColor: "#E5E7EB", color: "#111111" }}
            onFocus={(e) => { e.currentTarget.style.borderColor = "#2FBEB3"; e.currentTarget.style.boxShadow = "0 0 0 2px rgba(47,190,179,0.12)"; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = "#E5E7EB"; e.currentTarget.style.boxShadow = "none"; }}
          />
        </div>
      </div>
    </div>
  );
}

// ─── List view ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 10;

type SortKey = keyof ListLead | null;

export function PipelineList({ role, forceBulk }: { role: UserRole; forceBulk?: boolean }) {
  const router = useRouter();
  const { stages } = usePipelineStages();
  const [leads, setLeads] = useState<ListLead[]>([]);
  const [assignees, setAssignees] = useState<AssignableUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filters, setFiltersState] = useState<Record<string, string | null>>({
    stage: null, assignee: null, niche: null, priority: null, dateRange: null,
  });
  const [search, setSearch]     = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set(forceBulk ? ["2","3","9"] : []));
  const [page, setPage]         = useState(1);
  const [sortKey, setSortKey]   = useState<SortKey>("followUpDate");
  const [sortDir, setSortDir]   = useState<"up" | "down">("up");

  useEffect(() => {
    const loadLeads = async () => {
      try {
        const response = await fetch("/api/leads");
        const result = await response.json() as { leads?: ApiLead[]; error?: string };
        if (!response.ok) {
          setError(result.error ?? "Unable to load leads.");
          return;
        }
        setLeads((result.leads ?? []).map((lead) => {
          const stageDate = lead.stageChangedAt ? new Date(lead.stageChangedAt) : new Date(lead.createdAt);
          return {
            id: lead.id,
            priority: lead.priority ?? "cold",
            company: lead.company,
            niche: lead.niche,
            source: lead.source,
            contact: lead.contact,
            phone: lead.phone,
            stage: lead.stage,
            followUpDate: displayDate(lead.followUpDate),
            followUpTime: displayTime(lead.followUpTime),
            daysInStage: Math.max(0, Math.floor((Date.now() - stageDate.getTime()) / 86400000)),
            calls: lead.calls,
            assigneeInitials: initials(lead.assigneeName),
            assigneeName: lead.assigneeName,
            assigneeColor: assigneeColor(lead.assigneeName),
            urgency: urgencyFor(lead.followUpDate),
          };
        }));
      } catch {
        setError("Unable to reach the server. Please refresh and try again.");
      } finally {
        setLoading(false);
      }
    };
    void loadLeads();
  }, []);

  useEffect(() => {
    const loadAssignees = async () => {
      try {
        const response = await fetch("/api/users");
        const result = await response.json() as { users?: Array<AssignableUser & { status: string }> };
        if (!response.ok) return;
        setAssignees((result.users ?? []).filter((user) => user.status === "active"));
      } catch {
        setAssignees([]);
      }
    };
    void loadAssignees();
  }, []);

  const setFilter = (key: string, val: string | null) =>
    setFiltersState((prev) => ({ ...prev, [key]: val }));

  // Filter + search
  const visible = leads.filter((l) => {
    if (filters.stage    && l.stage !== filters.stage) return false;
    if (filters.assignee && l.assigneeName !== filters.assignee) return false;
    if (filters.niche    && l.niche !== filters.niche) return false;
    if (filters.priority && l.priority !== filters.priority) return false;
    if (filters.dateRange) {
      if (filters.dateRange === "Overdue"   && l.urgency !== "overdue") return false;
      if (filters.dateRange === "Today"     && l.urgency !== "today")   return false;
      if (filters.dateRange === "Next 7 days" && l.urgency !== "upcoming") return false;
    }
    if (search) {
      const q = search.toLowerCase();
      if (!l.company.toLowerCase().includes(q) && !l.contact.toLowerCase().includes(q) && !l.phone.includes(q)) return false;
    }
    return true;
  });

  // Sort
  const sorted = [...visible].sort((a, b) => {
    if (!sortKey) return 0;
    const av = a[sortKey], bv = b[sortKey];
    if (av === bv) return 0;
    const cmp = av! < bv! ? -1 : 1;
    return sortDir === "up" ? cmp : -cmp;
  });

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const paged = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const allPageSelected = paged.length > 0 && paged.every((l) => selected.has(l.id));

  const toggleAll = () => {
    if (allPageSelected) {
      setSelected((prev) => { const s = new Set(prev); paged.forEach((l) => s.delete(l.id)); return s; });
    } else {
      setSelected((prev) => { const s = new Set(prev); paged.forEach((l) => s.add(l.id)); return s; });
    }
  };

  const toggleRow = (id: string) => {
    if (role !== "superadmin") return;
    setSelected((prev) => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => d === "up" ? "down" : "up");
    else { setSortKey(key); setSortDir("up"); }
  };

  const handleBulkReassign = async (assigneeName: string) => {
    const assignee = assignees.find((candidate) => candidate.name === assigneeName);
    if (!assignee || !window.confirm(`Reassign ${selected.size} selected lead${selected.size === 1 ? "" : "s"} to ${assignee.name}?`)) return;

    const response = await fetch("/api/leads", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [...selected], assigneeName: assignee.name }),
    });
    if (!response.ok) return;
    setLeads((prev) => prev.map((lead) => selected.has(lead.id)
      ? { ...lead, assigneeName: assignee.name, assigneeInitials: assignee.initials, assigneeColor: assignee.color }
      : lead));
    setSelected(new Set());
  };

  const handleBulkDelete = async () => {
    if (!window.confirm(`Delete ${selected.size} selected lead${selected.size === 1 ? "" : "s"}? This cannot be undone.`)) return;
    const response = await fetch("/api/leads", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [...selected] }),
    });
    if (!response.ok) return;
    setLeads((prev) => prev.filter((lead) => !selected.has(lead.id)));
    setSelected(new Set());
  };

  const bulkActive = selected.size > 0 && role === "superadmin";

  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 64px)" }}>
      <ListTopBar role={role} />
      <FilterBar filters={filters} stages={stages} assignees={assignees} setFilter={setFilter} search={search} setSearch={setSearch} />

      {/* Table container */}
      <div className="flex-1 overflow-auto" style={{ padding: "16px 20px 80px" }}>
        {loading && <p style={{ padding: 24, color: "#6B7280", fontSize: 13 }}>Loading leads...</p>}
        {!loading && error && <p style={{ padding: 24, color: "#DC2626", fontSize: 13 }}>{error}</p>}
        <div
          style={{
            background: "#FFFFFF",
            border: "1px solid #E5E7EB",
            borderRadius: 8,
            boxShadow: "0 1px 3px rgba(17,17,17,0.06)",
            overflow: "hidden",
          }}
        >
          <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", minWidth: 1100, borderCollapse: "collapse", tableLayout: "fixed" }}>
            <colgroup>
              <col style={{ width: 40 }} />
              <col style={{ width: 32 }} />
              <col style={{ width: 160 }} />
              <col style={{ width: 120 }} />
              <col style={{ width: 100 }} />
              <col style={{ width: 130 }} />
              <col style={{ width: 128 }} />
              <col style={{ width: 140 }} />
              <col style={{ width: 100 }} />
              <col style={{ width: 90 }} />
              <col style={{ width: 90 }} />
              <col style={{ width: 72 }} />
              <col style={{ width: 150 }} />
            </colgroup>
            <thead>
              <tr>
                <TH width={40}>
                  {role === "superadmin" ? (
                    <div
                      onClick={toggleAll}
                      className="w-4 h-4 rounded flex items-center justify-center cursor-pointer"
                      style={{ border: `1.5px solid ${allPageSelected ? "#2FBEB3" : "#D1D5DB"}`, background: allPageSelected ? "#2FBEB3" : "#FFFFFF", margin: "0 auto" }}
                    >
                      {allPageSelected && <span style={{ color: "#fff" }}><CheckIcon /></span>}
                    </div>
                  ) : null}
                </TH>
                <TH center>PRI</TH>
                <TH sortable sortDir={sortKey === "company" ? sortDir : null} onClick={() => handleSort("company")}>Company</TH>
                <TH>Niche</TH>
                <TH>Source</TH>
                <TH>Contact</TH>
                <TH>Phone</TH>
                <TH sortable sortDir={sortKey === "stage" ? sortDir : null} onClick={() => handleSort("stage")}>Stage</TH>
                <TH sortable sortDir={sortKey === "followUpDate" ? sortDir : null} onClick={() => handleSort("followUpDate")}>Follow-up Date</TH>
                <TH>Time</TH>
                <TH sortable sortDir={sortKey === "daysInStage" ? sortDir : null} onClick={() => handleSort("daysInStage")} center>Days in Stage</TH>
                <TH sortable sortDir={sortKey === "calls" ? sortDir : null} onClick={() => handleSort("calls")} center>Calls</TH>
                <TH>Assignee</TH>
              </tr>
            </thead>
            <tbody>
              {paged.map((lead) => {
                const isSel = selected.has(lead.id);
                const style = rowStyles(lead, isSel);
                const hasLeftBorder = lead.urgency === "overdue" || lead.urgency === "today";

                return (
                  <tr
                    key={lead.id}
                    style={{ ...style, cursor: "pointer" }}
                    onClick={() => router.push(`/leads/${lead.id}`)}
                    onKeyDown={(e) => { if (e.key === "Enter") router.push(`/leads/${lead.id}`); }}
                    tabIndex={0}
                    onMouseEnter={(e) => {
                      if (!isSel) (e.currentTarget as HTMLTableRowElement).style.background =
                        lead.stale ? "#E8EEF4" : lead.urgency === "overdue" ? "#FEF2F2" : "#E3F7F5";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLTableRowElement).style.background = isSel ? "#E3F7F5"
                        : lead.stale ? "#F1F5F9" : lead.urgency === "overdue" ? "#FFF8F8"
                        : lead.urgency === "today" ? "#FFFBF0" : "#FFFFFF";
                    }}
                  >
                    {/* Checkbox */}
                    <td style={{ padding: "0 12px", textAlign: "center" }}>
                      {/* Invisible left-border fix: add colored strip for urgency rows */}
                      {hasLeftBorder && (
                        <div style={{
                          position: "absolute",
                          left: 0,
                          top: 0,
                          bottom: 0,
                          width: 3,
                          background: lead.urgency === "overdue" ? "#DC2626" : "#B45309",
                          borderRadius: "0 0 0 0",
                        }} />
                      )}
                      {role === "superadmin" && (
                        <div
                          onClick={(event) => { event.stopPropagation(); toggleRow(lead.id); }}
                          className="w-4 h-4 rounded flex items-center justify-center cursor-pointer"
                          style={{ border: `1.5px solid ${isSel ? "#2FBEB3" : "#D1D5DB"}`, background: isSel ? "#2FBEB3" : "#FFFFFF", margin: "0 auto" }}
                        >
                          {isSel && <span style={{ color: "#fff" }}><CheckIcon /></span>}
                        </div>
                      )}
                    </td>

                    {/* Priority dot */}
                    <td style={{ padding: "0 12px", textAlign: "center" }}>
                      <div className="w-2.5 h-2.5 rounded-full mx-auto" style={{ background: PRIORITY_COLOR[lead.priority] }} title={lead.priority} />
                    </td>

                    {/* Company */}
                    <td style={{ padding: "0 12px" }}>
                      <div className="flex items-center gap-1.5 min-w-0">
                        {lead.stale && (
                          <div className="w-2 h-2 rounded-full shrink-0" style={{ background: "#94A3B8" }} title="No activity" />
                        )}
                        <span className="truncate hover:underline" style={{ fontSize: 13, fontWeight: 500, color: "#111111" }}>{lead.company}</span>
                      </div>
                    </td>

                    {/* Niche */}
                    <td style={{ padding: "0 12px" }}>
                      <span className="truncate block" style={{ fontSize: 12, color: "#6B7280" }}>{lead.niche}</span>
                    </td>

                    {/* Source */}
                    <td style={{ padding: "0 12px" }}>
                      <span className="truncate block" style={{ fontSize: 12, color: "#6B7280" }}>{lead.source}</span>
                    </td>

                    {/* Contact */}
                    <td style={{ padding: "0 12px" }}>
                      <span className="truncate block" style={{ fontSize: 12, color: "#374151" }}>{lead.contact}</span>
                    </td>

                    {/* Phone */}
                    <td style={{ padding: "0 12px" }}>
                      <span className="truncate block" style={{ fontSize: 11, color: "#9CA3AF", fontFamily: "monospace" }}>{lead.phone}</span>
                    </td>

                    {/* Stage pill */}
                    <td style={{ padding: "0 12px" }}>
                      <span
                        className="inline-block px-2 py-0.5 rounded-full text-white truncate"
                        style={{ fontSize: 10, fontWeight: 500, background: stageColor(stages, lead.stage), maxWidth: 130, lineHeight: 1.6 }}
                      >
                        {lead.stage}
                      </span>
                    </td>

                    {/* Follow-up date */}
                    <td style={{ padding: "0 12px" }}>
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 500,
                          color: lead.urgency === "overdue" ? "#DC2626" : lead.urgency === "today" ? "#B45309" : "#374151",
                        }}
                      >
                        {lead.followUpDate}
                      </span>
                    </td>

                    {/* Follow-up time */}
                    <td style={{ padding: "0 12px" }}>
                      <span
                        className="px-1.5 py-0.5 rounded text-xs font-medium"
                        style={{
                          background: lead.urgency === "overdue" ? "#FEF2F2" : lead.urgency === "today" ? "#FEF3C7" : "#F3F4F6",
                          color:      lead.urgency === "overdue" ? "#DC2626" : lead.urgency === "today" ? "#B45309" : "#6B7280",
                        }}
                      >
                        {lead.followUpTime}
                      </span>
                    </td>

                    {/* Days in stage */}
                    <td style={{ padding: "0 12px", textAlign: "center" }}>
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 600,
                          color: lead.daysInStage >= 14 ? "#DC2626" : lead.daysInStage >= 7 ? "#D97706" : "#374151",
                        }}
                      >
                        {lead.daysInStage}d
                      </span>
                    </td>

                    {/* Calls */}
                    <td style={{ padding: "0 12px", textAlign: "center" }}>
                      <span style={{ fontSize: 12, color: "#374151" }}>{lead.calls}</span>
                    </td>

                    {/* Assignee */}
                    <td style={{ padding: "0 12px" }}>
                      <div className="flex items-center gap-2 min-w-0">
                        <div
                          className="w-6 h-6 rounded-full flex items-center justify-center text-white shrink-0"
                          style={{ fontSize: 9, fontWeight: 700, background: lead.assigneeColor }}
                        >
                          {lead.assigneeInitials}
                        </div>
                        <span className="truncate" style={{ fontSize: 12, color: "#374151" }}>{lead.assigneeName}</span>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {paged.length === 0 && (
                <tr>
                  <td colSpan={13} style={{ textAlign: "center", padding: 48, color: "#9CA3AF", fontSize: 13 }}>
                    No leads match the current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          </div>

          {/* Pagination */}
          <div
            className="flex items-center justify-between px-5"
            style={{ height: 52, borderTop: "1px solid #E5E7EB", background: "#FAFAFA" }}
          >
            <span style={{ fontSize: 12, color: "#9CA3AF" }}>
              Showing {Math.min((page - 1) * PAGE_SIZE + 1, sorted.length)}–{Math.min(page * PAGE_SIZE, sorted.length)} of {sorted.length} leads
            </span>
            <div className="flex items-center gap-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className="w-7 h-7 rounded-lg text-xs font-medium transition-all"
                  style={{
                    background: p === page ? "#2FBEB3" : "transparent",
                    color: p === page ? "#fff" : "#6B7280",
                    border: p === page ? "none" : "1px solid transparent",
                    cursor: "pointer",
                  }}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Bulk action bar — Superadmin only */}
      {bulkActive && (
        <BulkActionBar
          count={selected.size}
          assignees={assignees}
          onReassign={handleBulkReassign}
          onDelete={handleBulkDelete}
          onCancel={() => setSelected(new Set())}
        />
      )}
    </div>
  );
}
