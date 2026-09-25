"use client";

import type { CSSProperties, ReactNode } from "react";
import type { UserRole } from "@/lib/types";
import { stageColor } from "@/lib/pipeline-stages";
import { usePipelineStages } from "@/lib/use-pipeline-stages";
import { LOST_REASON_OPTIONS } from "@/components/LostReasonModal";

// ─── Palette constants ─────────────────────────────────────────────────────────

const PIPELINE_DATA = [
  { stage: "New Lead",       count: 142, pct: 21 },
  { stage: "No Answer",      count: 87,  pct: 13 },
  { stage: "Try Again",      count: 63,  pct: 9  },
  { stage: "Conversation",   count: 94,  pct: 14 },
  { stage: "Proposal Sent",  count: 71,  pct: 11 },
  { stage: "Estimate Sent",  count: 45,  pct: 7  },
  { stage: "Meeting Booked", count: 38,  pct: 6  },
  { stage: "Closed Won",     count: 112, pct: 17 },
  { stage: "Closed Lost",    count: 42,  pct: 6  },
  { stage: "Dead Lead",      count: 21,  pct: 3  },
];

const AVG_DAYS = [
  { stage: "New Lead",       days: 1.2 },
  { stage: "No Answer",      days: 3.8 },
  { stage: "Try Again",      days: 2.9 },
  { stage: "Conversation",   days: 5.1 },
  { stage: "Proposal Sent",  days: 8.4 },
  { stage: "Estimate Sent",  days: 6.2 },
  { stage: "Meeting Booked", days: 4.2 },
  { stage: "Closed Won",     days: 12.6 },
  { stage: "Closed Lost",    days: 9.3 },
  { stage: "Dead Lead",      days: 6.7 },
];

const TODAY_FOLLOWUPS = [
  { time: "09:00", company: "Meridian Corp", contact: "Sarah Blake",   stage: "Proposal Sent" },
  { time: "10:30", company: "Vanguard Tech",  contact: "Raj Patel",    stage: "Meeting Booked" },
  { time: "11:45", company: "Solaris Group",  contact: "Emma Novak",   stage: "Conversation" },
  { time: "14:00", company: "Apex Industries",contact: "Derek Owens",  stage: "No Answer" },
  { time: "15:30", company: "Orion Partners", contact: "Julia Chen",   stage: "Try Again" },
];

const MISSED_FOLLOWUPS = [
  { time: "Yesterday 16:00", company: "Nexus Digital",  contact: "Tom Brennan",  stage: "Proposal Sent" },
  { time: "Yesterday 11:00", company: "Crestline Labs", contact: "Priya Singh",  stage: "Conversation" },
  { time: "Mon 09:30",       company: "Atlas Holdings", contact: "Carlos Ruiz",  stage: "Meeting Booked" },
];

const UPCOMING_FOLLOWUPS = [
  { time: "Tomorrow",  company: "Pinnacle Health", contact: "Diane Yuen",    stage: "Conversation" },
  { time: "Wed 10:00", company: "Redwood Capital", contact: "Marcus Webb",   stage: "Proposal Sent" },
  { time: "Thu 14:30", company: "Summit Partners", contact: "Keiko Tanaka",  stage: "New Lead" },
  { time: "Fri 09:00", company: "Crestview Corp",  contact: "Liam O'Brien",  stage: "No Answer" },
];

const TEAM_DATA = [
  { initials: "JC", name: "James Carter",  callsToday: 14, callsWeek: 61, updatedToday: 8,  convRate: 34 },
  { initials: "AS", name: "Aisha Santos",  callsToday: 11, callsWeek: 54, updatedToday: 6,  convRate: 29 },
  { initials: "MR", name: "Marco Rivera",  callsToday: 9,  callsWeek: 47, updatedToday: 5,  convRate: 22 },
  { initials: "NW", name: "Natalie Wong",  callsToday: 12, callsWeek: 58, updatedToday: 9,  convRate: 38 },
  { initials: "DK", name: "Derek Kim",     callsToday: 7,  callsWeek: 39, updatedToday: 4,  convRate: 19 },
];

// Demo counts aligned with LOST_REASON_OPTIONS — live feeds replace these later
const LOST_REASONS = [
  { reason: LOST_REASON_OPTIONS[0], count: 34 },
  { reason: LOST_REASON_OPTIONS[1], count: 28 },
  { reason: LOST_REASON_OPTIONS[2], count: 19 },
  { reason: LOST_REASON_OPTIONS[3], count: 14 },
  { reason: LOST_REASON_OPTIONS[4], count: 11 },
  { reason: LOST_REASON_OPTIONS[5], count: 8  },
];

// ─── Shared small components ───────────────────────────────────────────────────

function StagePill({ stage }: { stage: string }) {
  const { stages } = usePipelineStages();
  return (
    <span
      className="inline-block px-2 py-0.5 rounded-full text-white"
      style={{ fontSize: 10, fontWeight: 500, background: stageColor(stages, stage), lineHeight: 1.5 }}
    >
      {stage}
    </span>
  );
}

function Card({
  children,
  style,
  className = "",
  accentColor,
}: {
  children: ReactNode;
  style?: CSSProperties;
  className?: string;
  accentColor?: string;
}) {
  return (
    <div
      className={className}
      style={{
        background: "#FFFFFF",
        border: "1px solid #E5E7EB",
        borderRadius: 8,
        boxShadow: "0 1px 3px rgba(17,17,17,0.06)",
        borderTop: accentColor ? `3px solid ${accentColor}` : undefined,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <h2 style={{ fontSize: 14, fontWeight: 600, color: "#111111", marginBottom: 12 }}>{children}</h2>
  );
}

function ViewAllLink() {
  return (
    <a href="#" onClick={(e) => e.preventDefault()} style={{ fontSize: 12, color: "#2FBEB3", fontWeight: 500, textDecoration: "none" }}
      onMouseEnter={(e) => ((e.currentTarget as HTMLAnchorElement).style.color = "#0E7A70")}
      onMouseLeave={(e) => ((e.currentTarget as HTMLAnchorElement).style.color = "#2FBEB3")}>
      View all →
    </a>
  );
}

// ─── Section 1: Follow-up summary ─────────────────────────────────────────────

function TodayFollowupsCard() {
  return (
    <Card style={{ padding: "16px 20px", flex: 1, minWidth: 0 }}>
      <div className="flex items-center justify-between mb-3">
        <h3 style={{ fontSize: 14, fontWeight: 600, color: "#111111" }}>Today&apos;s Follow-ups</h3>
        <ViewAllLink />
      </div>
      <div className="flex flex-col">
        {TODAY_FOLLOWUPS.map(({ time, company, contact, stage }) => (
          <div key={time + company}
            className="flex items-center gap-3 py-2.5 transition-colors"
            style={{ borderTop: "1px solid #F3F4F6", cursor: "default" }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLDivElement).style.background = "#F9FAFB")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLDivElement).style.background = "transparent")}
          >
            <span
              className="shrink-0 px-1.5 py-0.5 rounded"
              style={{ fontSize: 11, fontWeight: 600, color: "#B45309", background: "#FEF3C7", minWidth: 44, textAlign: "center" }}
            >
              {time}
            </span>
            <div className="flex-1 min-w-0">
              <div style={{ fontSize: 13, fontWeight: 500, color: "#111111" }} className="truncate">{company}</div>
              <div style={{ fontSize: 11, color: "#9CA3AF" }}>{contact}</div>
            </div>
            <StagePill stage={stage} />
          </div>
        ))}
      </div>
    </Card>
  );
}

function MissedFollowupsCard() {
  return (
    <Card
      style={{ padding: "16px 20px", flex: 1, minWidth: 0, borderLeft: "3px solid #DC2626" }}
    >
      <div className="flex items-center justify-between mb-3">
        <h3 style={{ fontSize: 14, fontWeight: 600, color: "#DC2626" }}>Missed Follow-ups</h3>
        <ViewAllLink />
      </div>
      <div className="flex flex-col">
        {MISSED_FOLLOWUPS.map(({ time, company, contact, stage }) => (
          <div key={time + company}
            className="flex items-center gap-3 py-2.5 transition-colors"
            style={{ borderTop: "1px solid #F3F4F6" }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLDivElement).style.background = "#FFF8F8")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLDivElement).style.background = "transparent")}
          >
            <span
              className="shrink-0 px-1.5 py-0.5 rounded"
              style={{ fontSize: 11, fontWeight: 600, color: "#DC2626", background: "#FEF2F2", minWidth: 44, textAlign: "center" }}
            >
              {time.split(" ")[0]}
            </span>
            <div className="flex-1 min-w-0">
              <div style={{ fontSize: 13, fontWeight: 500, color: "#111111" }} className="truncate">{company}</div>
              <div style={{ fontSize: 11, color: "#9CA3AF" }}>{contact}</div>
            </div>
            <StagePill stage={stage} />
          </div>
        ))}
      </div>
      <div className="mt-3 pt-3" style={{ borderTop: "1px solid #F3F4F6" }}>
        <div style={{ fontSize: 12, color: "#DC2626", fontWeight: 500 }}>3 overdue — action required</div>
      </div>
    </Card>
  );
}

function UpcomingFollowupsCard() {
  return (
    <Card style={{ padding: "16px 20px", flex: 1, minWidth: 0 }}>
      <div className="flex items-center justify-between mb-3">
        <h3 style={{ fontSize: 14, fontWeight: 600, color: "#111111" }}>
          Upcoming <span style={{ fontWeight: 400, color: "#9CA3AF", fontSize: 12 }}>— next 7 days</span>
        </h3>
        <ViewAllLink />
      </div>
      <div className="flex flex-col">
        {UPCOMING_FOLLOWUPS.map(({ time, company, contact, stage }) => (
          <div key={time + company}
            className="flex items-center gap-3 py-2.5 transition-colors"
            style={{ borderTop: "1px solid #F3F4F6" }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLDivElement).style.background = "#E3F7F5")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLDivElement).style.background = "transparent")}
          >
            <span
              className="shrink-0 px-1.5 py-0.5 rounded"
              style={{ fontSize: 11, fontWeight: 500, color: "#0E7A70", background: "#E3F7F5", minWidth: 44, textAlign: "center" }}
            >
              {time.split(" ")[0]}
            </span>
            <div className="flex-1 min-w-0">
              <div style={{ fontSize: 13, fontWeight: 500, color: "#111111" }} className="truncate">{company}</div>
              <div style={{ fontSize: 11, color: "#9CA3AF" }}>{contact}</div>
            </div>
            <StagePill stage={stage} />
          </div>
        ))}
      </div>
    </Card>
  );
}

// ─── Section 2: KPI cards ──────────────────────────────────────────────────────

function WinRateRing({ pct }: { pct: number }) {
  const r = 28;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  return (
    <svg width="72" height="72" viewBox="0 0 72 72">
      <circle cx="36" cy="36" r={r} fill="none" stroke="#E5E7EB" strokeWidth="6" />
      <circle cx="36" cy="36" r={r} fill="none" stroke="#2FBEB3" strokeWidth="6"
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
        transform="rotate(-90 36 36)" />
      <text x="36" y="41" textAnchor="middle" style={{ fontSize: 14, fontWeight: 700, fill: "#111111", fontFamily: "Inter, sans-serif" }}>
        {pct}%
      </text>
    </svg>
  );
}

const KPI_CARDS = [
  {
    label: "Total Leads",           value: "670", sub: "+48 this month",          accent: "#2FBEB3",
    numColor: "#111111",
  },
  {
    label: "Closed Won",            value: "112", sub: "16.7% of pipeline",       accent: "#16A34A",
    numColor: "#16A34A",
  },
  {
    label: "Closed Lost",           value: "42",  sub: "6.3% of pipeline",        accent: "#57534E",
    numColor: "#57534E",
  },
  {
    label: "Dead Leads",            value: "21",  sub: "Removed from pipeline",   accent: "#DC2626",
    numColor: "#DC2626",
  },
  {
    label: "Win Rate",              value: null,  sub: "vs. 29% last month",      accent: "#2FBEB3",
    numColor: "#111111", ring: 34,
  },
  {
    label: "Leads — No Activity",   value: "88",  sub: "No update in 14+ days",   accent: "#94A3B8",
    numColor: "#94A3B8",
  },
  {
    label: "Leads-No Status Update", value: "54",  sub: "Stage unchanged 7+ days", accent: "#94A3B8",
    numColor: "#94A3B8",
  },
  {
    label: "Missed Follow-ups",     value: "3",   sub: "Action required today",   accent: "#DC2626",
    numColor: "#DC2626",
  },
];

function KPISection() {
  return (
    <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
      {KPI_CARDS.map(({ label, value, sub, accent, numColor, ring }) => (
        <Card key={label} accentColor={accent} style={{ padding: "16px 20px" }}>
          <div style={{ fontSize: 12, fontWeight: 500, color: "#6B7280", marginBottom: 8 }}>{label}</div>
          {ring !== undefined ? (
            <div className="flex items-center gap-3">
              <WinRateRing pct={ring} />
              <div style={{ fontSize: 12, color: "#6B7280" }}>{sub}</div>
            </div>
          ) : (
            <>
              <div style={{ fontSize: 32, fontWeight: 700, color: numColor, lineHeight: 1.1, marginBottom: 4 }}>{value}</div>
              <div style={{ fontSize: 12, color: "#9CA3AF" }}>{sub}</div>
            </>
          )}
        </Card>
      ))}
    </div>
  );
}

// ─── Section 3: Pipeline health ────────────────────────────────────────────────

function PipelineHealthCard() {
  const { stages } = usePipelineStages();
  const maxDays = Math.max(...AVG_DAYS.map((d) => d.days));

  return (
    <Card style={{ padding: "20px 24px" }}>
      <div className="flex items-center justify-between mb-5">
        <h3 style={{ fontSize: 15, fontWeight: 600, color: "#111111" }}>Pipeline Health</h3>
        <div
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg"
          style={{ background: "#FEF2F2", border: "1px solid #FCA5A5" }}
        >
          <span style={{ fontSize: 18, fontWeight: 700, color: "#DC2626" }}>17</span>
          <span style={{ fontSize: 11, color: "#DC2626", fontWeight: 500 }}>overdue leads</span>
        </div>
      </div>

      {/* Stacked bar */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 500, color: "#9CA3AF", marginBottom: 6 }}>
          670 total leads — by pipeline stage
        </div>
        <div className="flex rounded-lg overflow-hidden" style={{ height: 28 }}>
          {PIPELINE_DATA.map(({ stage, pct }) => (
            <div
              key={stage}
              title={`${stage}: ${pct}%`}
              className="transition-opacity hover:opacity-80"
              style={{ width: `${pct}%`, background: stageColor(stages, stage), minWidth: pct > 0 ? 2 : 0 }}
            />
          ))}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-x-4 gap-y-2 mt-4">
          {PIPELINE_DATA.map(({ stage, count }) => (
            <div key={stage} className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: stageColor(stages, stage) }} />
              <span style={{ fontSize: 11, color: "#6B7280" }}>{stage}</span>
              <span
                className="px-1.5 py-0.5 rounded-full text-white"
                style={{ fontSize: 10, fontWeight: 600, background: stageColor(stages, stage) }}
              >
                {count}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Avg days per stage */}
      <div className="mt-6 pt-5" style={{ borderTop: "1px solid #F3F4F6" }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: "#6B7280", marginBottom: 10 }}>Avg. Days per Stage</div>
        <div className="flex flex-col gap-2.5">
          {AVG_DAYS.map(({ stage, days }) => (
            <div key={stage} className="flex items-center gap-3">
              <div style={{ fontSize: 12, color: "#6B7280", width: 120 }} className="shrink-0">{stage}</div>
              <div className="flex-1 h-1.5 rounded-full" style={{ background: "#F3F4F6" }}>
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${(days / maxDays) * 100}%`, background: stageColor(stages, stage) }}
                />
              </div>
              <div style={{ fontSize: 12, fontWeight: 500, color: "#111111", width: 40, textAlign: "right" }}>{days}d</div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

// ─── Section 4: Team activity ──────────────────────────────────────────────────

const AVATAR_COLORS = ["#2FBEB3", "#6366F1", "#F59E0B", "#16A34A", "#F97316"];

function TeamActivityCard() {
  return (
    <Card style={{ overflow: "hidden" }}>
      <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: "1px solid #E5E7EB" }}>
        <h3 style={{ fontSize: 15, fontWeight: 600, color: "#111111" }}>Team Activity</h3>
        <span style={{ fontSize: 11, color: "#9CA3AF" }}>Today · {new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short" })}</span>
      </div>
      <table className="w-full" style={{ borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ background: "#FAFAFA" }}>
            {["Salesperson", "Calls Today", "Calls This Week", "Leads Updated Today", "Conv. Rate"].map((h) => (
              <th key={h}
                className={h === "Leads Updated Today" ? "text-center px-6" : "text-left px-6"}
                style={{ height: 40, fontSize: 11, fontWeight: 600, color: "#6B7280", letterSpacing: "0.04em", borderBottom: "1px solid #E5E7EB" }}>
                {h.toUpperCase()}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {TEAM_DATA.map(({ initials, name, callsToday, callsWeek, updatedToday, convRate }, i) => (
            <tr
              key={name}
              style={{ borderBottom: "1px solid #F3F4F6", height: 48 }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLTableRowElement).style.background = "#E3F7F5")}
              onMouseLeave={(e) => ((e.currentTarget as HTMLTableRowElement).style.background = "transparent")}
            >
              <td className="px-6">
                <div className="flex items-center gap-2.5">
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center text-white shrink-0"
                    style={{ fontSize: 10, fontWeight: 700, background: AVATAR_COLORS[i % AVATAR_COLORS.length] }}
                  >
                    {initials}
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 500, color: "#111111" }}>{name}</span>
                </div>
              </td>
              <td className="px-6" style={{ fontSize: 13, color: "#111111", fontWeight: 600 }}>{callsToday}</td>
              <td className="px-6" style={{ fontSize: 13, color: "#111111" }}>{callsWeek}</td>
              <td className="px-6 text-center" style={{ fontSize: 13, color: "#111111", fontWeight: 600 }}>{updatedToday}</td>
              <td className="px-6">
                <div className="flex items-center gap-2.5">
                  <div className="flex-1 h-1.5 rounded-full" style={{ background: "#E5E7EB", maxWidth: 80 }}>
                    <div className="h-full rounded-full" style={{ width: `${convRate}%`, background: "#2FBEB3" }} />
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "#0E7A70" }}>{convRate}%</span>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

// ─── Section 5: Lost reason analysis ──────────────────────────────────────────

function LostReasonCard() {
  const max = LOST_REASONS[0].count;
  return (
    <Card style={{ padding: "20px 24px", flex: 1 }}>
      <div className="flex items-center justify-between mb-5">
        <h3 style={{ fontSize: 15, fontWeight: 600, color: "#111111" }}>Lost Reason Analysis</h3>
        <span style={{ fontSize: 11, color: "#9CA3AF" }}>42 total closed-lost</span>
      </div>
      <div className="flex flex-col gap-3">
        {LOST_REASONS.map(({ reason, count }) => (
          <div key={reason} className="flex items-center gap-3">
            <div style={{ fontSize: 12, color: "#6B7280", width: 200 }} className="shrink-0 truncate">{reason}</div>
            <div className="flex-1 h-5 rounded flex items-center overflow-hidden" style={{ background: "#F1F5F9" }}>
              <div
                className="h-full rounded transition-all"
                style={{ width: `${(count / max) * 100}%`, background: "#57534E", minWidth: 4 }}
              />
            </div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#57534E", width: 24, textAlign: "right" }}>{count}</div>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ─── Dashboard root ────────────────────────────────────────────────────────────

export function Dashboard({ role }: { role: UserRole }) {
  return (
    <div style={{ padding: 24 }}>
      {/* Role badge */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div style={{ fontSize: 13, color: "#9CA3AF" }}>
            {new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span style={{ fontSize: 12, color: "#6B7280" }}>Viewing as</span>
          <span
            className="px-2 py-0.5 rounded-full text-white"
            style={{ fontSize: 11, fontWeight: 600, background: role === "superadmin" ? "#0E7A70" : "#9CA3AF" }}
          >
            {role === "superadmin" ? "Superadmin" : "Admin"}
          </span>
          {role !== "superadmin" && (
            <span style={{ fontSize: 11, color: "#9CA3AF" }}>— Sections 4 &amp; 5 hidden</span>
          )}
        </div>
      </div>

      {/* Section 1 — Follow-up summary */}
      <div className="mb-6">
        <SectionLabel>Follow-up Summary</SectionLabel>
        <div className="flex gap-4">
          <TodayFollowupsCard />
          <MissedFollowupsCard />
          <UpcomingFollowupsCard />
        </div>
      </div>

      {/* Section 2 — KPIs */}
      <div className="mb-6">
        <SectionLabel>Sales Performance</SectionLabel>
        <KPISection />
      </div>

      {/* Section 3 — Pipeline health */}
      <div className="mb-6">
        <SectionLabel>Pipeline Health</SectionLabel>
        <PipelineHealthCard />
      </div>

      {/* Sections 4 & 5 — Superadmin only */}
      {role === "superadmin" && (
        <>
          <div className="mb-6">
            <SectionLabel>Team Activity</SectionLabel>
            <TeamActivityCard />
          </div>

          <div className="mb-6">
            <SectionLabel>Lost Reason Analysis</SectionLabel>
            <div className="flex gap-4">
              <LostReasonCard />
              {/* Spacer card for layout balance */}
              <Card style={{ flex: 1, padding: "20px 24px", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", gap: 8 }}>
                <div style={{ fontSize: 32, fontWeight: 700, color: "#57534E" }}>42</div>
                <div style={{ fontSize: 13, fontWeight: 500, color: "#6B7280" }}>Total Closed Lost</div>
                <div style={{ fontSize: 12, color: "#9CA3AF", textAlign: "center", maxWidth: 180 }}>
                  6.3% of pipeline — deliberate charcoal, not alarm red
                </div>
                <div className="mt-4 w-full" style={{ borderTop: "1px solid #E5E7EB", paddingTop: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "#9CA3AF", marginBottom: 8 }}>TOP REASON</div>
                  <div style={{ fontSize: 14, fontWeight: 500, color: "#57534E" }}>Price / budget constraints</div>
                  <div style={{ fontSize: 12, color: "#9CA3AF" }}>34 leads (81% of closed-lost)</div>
                </div>
              </Card>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
