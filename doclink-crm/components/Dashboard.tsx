"use client";

import type { CSSProperties, ReactNode } from "react";
import type { UserRole } from "@/lib/types";
import { stageColor } from "@/lib/pipeline-stages";
import { usePipelineStages } from "@/lib/use-pipeline-stages";
import {
  useDashboardData,
  type DashboardFollowUp,
  type DashboardStageHealth,
  type DashboardTeamMember,
  type DashboardLostReason,
} from "@/lib/use-dashboard-data";

// ─── Date/time formatting helpers ──────────────────────────────────────────

function fmtTime(time: string | null) {
  if (!time) return "—";
  const d = new Date(time);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
}

function fmtRelativeDay(dateStr: string | null) {
  if (!dateStr) return "—";
  const target = new Date(dateStr);
  if (Number.isNaN(target.getTime())) return "—";
  target.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.round((target.getTime() - today.getTime()) / 86_400_000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  if (diffDays === -1) return "Yesterday";
  if (diffDays < 0) return target.toLocaleDateString("en-GB", { weekday: "short" });
  if (diffDays <= 6) return target.toLocaleDateString("en-GB", { weekday: "short" });
  return target.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

// ─── Shared small components ───────────────────────────────────────────────

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

function EmptyRow({ label }: { label: string }) {
  return <div style={{ fontSize: 12, color: "#9CA3AF", padding: "12px 0" }}>{label}</div>;
}

// ─── Section 1: Follow-up summary ─────────────────────────────────────────────

function TodayFollowupsCard({ items }: { items: DashboardFollowUp[] }) {
  return (
    <Card style={{ padding: "16px 20px", flex: 1, minWidth: 0 }}>
      <div className="flex items-center justify-between mb-3">
        <h3 style={{ fontSize: 14, fontWeight: 600, color: "#111111" }}>Today&apos;s Follow-ups</h3>
        <ViewAllLink />
      </div>
      <div className="flex flex-col">
        {items.length === 0 && <EmptyRow label="No follow-ups scheduled for today." />}
        {items.map((item) => (
          <div key={item.id}
            className="flex items-center gap-3 py-2.5 transition-colors"
            style={{ borderTop: "1px solid #F3F4F6", cursor: "default" }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLDivElement).style.background = "#F9FAFB")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLDivElement).style.background = "transparent")}
          >
            <span
              className="shrink-0 px-1.5 py-0.5 rounded"
              style={{ fontSize: 11, fontWeight: 600, color: "#B45309", background: "#FEF3C7", minWidth: 44, textAlign: "center" }}
            >
              {fmtTime(item.followUpTime)}
            </span>
            <div className="flex-1 min-w-0">
              <div style={{ fontSize: 13, fontWeight: 500, color: "#111111" }} className="truncate">{item.company}</div>
              <div style={{ fontSize: 11, color: "#9CA3AF" }}>{item.contact}</div>
            </div>
            <StagePill stage={item.stage} />
          </div>
        ))}
      </div>
    </Card>
  );
}

function MissedFollowupsCard({ items }: { items: DashboardFollowUp[] }) {
  return (
    <Card
      style={{ padding: "16px 20px", flex: 1, minWidth: 0, borderLeft: "3px solid #DC2626" }}
    >
      <div className="flex items-center justify-between mb-3">
        <h3 style={{ fontSize: 14, fontWeight: 600, color: "#DC2626" }}>Missed Follow-ups</h3>
        <ViewAllLink />
      </div>
      <div className="flex flex-col">
        {items.length === 0 && <EmptyRow label="No missed follow-ups." />}
        {items.map((item) => (
          <div key={item.id}
            className="flex items-center gap-3 py-2.5 transition-colors"
            style={{ borderTop: "1px solid #F3F4F6" }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLDivElement).style.background = "#FFF8F8")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLDivElement).style.background = "transparent")}
          >
            <span
              className="shrink-0 px-1.5 py-0.5 rounded"
              style={{ fontSize: 11, fontWeight: 600, color: "#DC2626", background: "#FEF2F2", minWidth: 44, textAlign: "center" }}
            >
              {fmtRelativeDay(item.followUpDate)}
            </span>
            <div className="flex-1 min-w-0">
              <div style={{ fontSize: 13, fontWeight: 500, color: "#111111" }} className="truncate">{item.company}</div>
              <div style={{ fontSize: 11, color: "#9CA3AF" }}>{item.contact}</div>
            </div>
            <StagePill stage={item.stage} />
          </div>
        ))}
      </div>
      {items.length > 0 && (
        <div className="mt-3 pt-3" style={{ borderTop: "1px solid #F3F4F6" }}>
          <div style={{ fontSize: 12, color: "#DC2626", fontWeight: 500 }}>
            {items.length} overdue — action required
          </div>
        </div>
      )}
    </Card>
  );
}

function UpcomingFollowupsCard({ items }: { items: DashboardFollowUp[] }) {
  return (
    <Card style={{ padding: "16px 20px", flex: 1, minWidth: 0 }}>
      <div className="flex items-center justify-between mb-3">
        <h3 style={{ fontSize: 14, fontWeight: 600, color: "#111111" }}>
          Upcoming <span style={{ fontWeight: 400, color: "#9CA3AF", fontSize: 12 }}>— next 7 days</span>
        </h3>
        <ViewAllLink />
      </div>
      <div className="flex flex-col">
        {items.length === 0 && <EmptyRow label="Nothing coming up in the next 7 days." />}
        {items.map((item) => (
          <div key={item.id}
            className="flex items-center gap-3 py-2.5 transition-colors"
            style={{ borderTop: "1px solid #F3F4F6" }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLDivElement).style.background = "#E3F7F5")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLDivElement).style.background = "transparent")}
          >
            <span
              className="shrink-0 px-1.5 py-0.5 rounded"
              style={{ fontSize: 11, fontWeight: 500, color: "#0E7A70", background: "#E3F7F5", minWidth: 44, textAlign: "center" }}
            >
              {fmtRelativeDay(item.followUpDate)}
            </span>
            <div className="flex-1 min-w-0">
              <div style={{ fontSize: 13, fontWeight: 500, color: "#111111" }} className="truncate">{item.company}</div>
              <div style={{ fontSize: 11, color: "#9CA3AF" }}>{item.contact}</div>
            </div>
            <StagePill stage={item.stage} />
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

function KPISection({ kpis }: { kpis: NonNullable<ReturnType<typeof useDashboardData>["data"]>["kpis"] }) {
  const cards = [
    { label: "Total Leads", value: String(kpis.totalLeads), sub: "All leads in view", accent: "#2FBEB3", numColor: "#111111" },
    { label: "Closed Won", value: String(kpis.closedWon), sub: `${kpis.totalLeads > 0 ? Math.round((kpis.closedWon / kpis.totalLeads) * 100) : 0}% of pipeline`, accent: "#16A34A", numColor: "#16A34A" },
    { label: "Closed Lost", value: String(kpis.closedLost), sub: `${kpis.totalLeads > 0 ? Math.round((kpis.closedLost / kpis.totalLeads) * 100) : 0}% of pipeline`, accent: "#57534E", numColor: "#57534E" },
    { label: "Dead Leads", value: String(kpis.deadLeads), sub: "Removed from pipeline", accent: "#DC2626", numColor: "#DC2626" },
    { label: "Win Rate", value: null, sub: "Closed Won vs Closed Lost", accent: "#2FBEB3", numColor: "#111111", ring: kpis.winRate },
    { label: "Leads — No Activity", value: String(kpis.noActivityCount), sub: "No update in 14+ days", accent: "#94A3B8", numColor: "#94A3B8" },
    { label: "Leads — No Status Update", value: String(kpis.noStatusUpdateCount), sub: "Stage unchanged 7+ days", accent: "#94A3B8", numColor: "#94A3B8" },
    { label: "Missed Follow-ups", value: String(kpis.missedFollowUpsCount), sub: "Action required", accent: "#DC2626", numColor: "#DC2626" },
  ];

  return (
    <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
      {cards.map(({ label, value, sub, accent, numColor, ring }) => (
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

function PipelineHealthCard({
  stages,
  totalLeads,
  overdueCount,
}: {
  stages: DashboardStageHealth[];
  totalLeads: number;
  overdueCount: number;
}) {
  const { stages: stageColors } = usePipelineStages();
  const maxDays = Math.max(1, ...stages.map((s) => s.avgDays));

  return (
    <Card style={{ padding: "20px 24px" }}>
      <div className="flex items-center justify-between mb-5">
        <h3 style={{ fontSize: 15, fontWeight: 600, color: "#111111" }}>Pipeline Health</h3>
        <div
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg"
          style={{ background: "#FEF2F2", border: "1px solid #FCA5A5" }}
        >
          <span style={{ fontSize: 18, fontWeight: 700, color: "#DC2626" }}>{overdueCount}</span>
          <span style={{ fontSize: 11, color: "#DC2626", fontWeight: 500 }}>overdue leads</span>
        </div>
      </div>

      {/* Stacked bar */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 500, color: "#9CA3AF", marginBottom: 6 }}>
          {totalLeads} total leads — by pipeline stage
        </div>
        <div className="flex rounded-lg overflow-hidden" style={{ height: 28 }}>
          {stages.map(({ stage, pct }) => (
            <div
              key={stage}
              title={`${stage}: ${pct}%`}
              className="transition-opacity hover:opacity-80"
              style={{ width: `${pct}%`, background: stageColor(stageColors, stage), minWidth: pct > 0 ? 2 : 0 }}
            />
          ))}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-x-4 gap-y-2 mt-4">
          {stages.map(({ stage, count }) => (
            <div key={stage} className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: stageColor(stageColors, stage) }} />
              <span style={{ fontSize: 11, color: "#6B7280" }}>{stage}</span>
              <span
                className="px-1.5 py-0.5 rounded-full text-white"
                style={{ fontSize: 10, fontWeight: 600, background: stageColor(stageColors, stage) }}
              >
                {count}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Avg days per stage (dwell time of leads currently in each stage) */}
      <div className="mt-6 pt-5" style={{ borderTop: "1px solid #F3F4F6" }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: "#6B7280", marginBottom: 10 }}>Avg. Days in Current Stage</div>
        <div className="flex flex-col gap-2.5">
          {stages.map(({ stage, avgDays }) => (
            <div key={stage} className="flex items-center gap-3">
              <div style={{ fontSize: 12, color: "#6B7280", width: 120 }} className="shrink-0">{stage}</div>
              <div className="flex-1 h-1.5 rounded-full" style={{ background: "#F3F4F6" }}>
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${(avgDays / maxDays) * 100}%`, background: stageColor(stageColors, stage) }}
                />
              </div>
              <div style={{ fontSize: 12, fontWeight: 500, color: "#111111", width: 40, textAlign: "right" }}>{avgDays}d</div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

// ─── Section 4: Team activity ──────────────────────────────────────────────────

const AVATAR_COLORS = ["#2FBEB3", "#6366F1", "#F59E0B", "#16A34A", "#F97316"];

function TeamActivityCard({ team }: { team: DashboardTeamMember[] }) {
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
          {team.map(({ id, initials, name, callsToday, callsWeek, updatedToday, convRate }, i) => (
            <tr
              key={id}
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

function LostReasonCard({ reasons }: { reasons: DashboardLostReason[] }) {
  const total = reasons.reduce((sum, r) => sum + r.count, 0);
  const max = Math.max(1, ...reasons.map((r) => r.count));
  const top = reasons[0];

  return (
    <div className="flex gap-4" style={{ flex: 1 }}>
      <Card style={{ padding: "20px 24px", flex: 1 }}>
        <div className="flex items-center justify-between mb-5">
          <h3 style={{ fontSize: 15, fontWeight: 600, color: "#111111" }}>Lost Reason Analysis</h3>
          <span style={{ fontSize: 11, color: "#9CA3AF" }}>{total} total closed-lost</span>
        </div>
        <div className="flex flex-col gap-3">
          {reasons.length === 0 && <EmptyRow label="No closed-lost leads yet." />}
          {reasons.map(({ reason, count }) => (
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

      <Card style={{ flex: 1, padding: "20px 24px", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", gap: 8 }}>
        <div style={{ fontSize: 32, fontWeight: 700, color: "#57534E" }}>{total}</div>
        <div style={{ fontSize: 13, fontWeight: 500, color: "#6B7280" }}>Total Closed Lost</div>
        {top && (
          <div className="mt-4 w-full" style={{ borderTop: "1px solid #E5E7EB", paddingTop: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "#9CA3AF", marginBottom: 8 }}>TOP REASON</div>
            <div style={{ fontSize: 14, fontWeight: 500, color: "#57534E" }}>{top.reason}</div>
            <div style={{ fontSize: 12, color: "#9CA3AF" }}>
              {top.count} leads ({total > 0 ? Math.round((top.count / total) * 100) : 0}% of closed-lost)
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

// ─── Dashboard root ────────────────────────────────────────────────────────────

export function Dashboard({ role }: { role: UserRole }) {
  const { data, loading, error, reload } = useDashboardData();

  if (loading && !data) {
    return <div style={{ padding: 24, fontSize: 13, color: "#6B7280" }}>Loading dashboard…</div>;
  }

  if (error) {
    return (
      <div style={{ padding: 24 }}>
        <div style={{ fontSize: 13, color: "#DC2626", marginBottom: 12 }}>{error}</div>
        <button
          type="button"
          onClick={() => void reload()}
          className="rounded-lg font-semibold"
          style={{ height: 34, paddingInline: 14, fontSize: 12, color: "#FFFFFF", background: "#57534E" }}
        >
          Retry
        </button>
      </div>
    );
  }

  if (!data) return null;

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
        </div>
      </div>

      {/* Section 1 — Follow-up summary */}
      <div className="mb-6">
        <SectionLabel>Follow-up Summary</SectionLabel>
        <div className="flex gap-4">
          <TodayFollowupsCard items={data.followUps.today} />
          <MissedFollowupsCard items={data.followUps.missed} />
          <UpcomingFollowupsCard items={data.followUps.upcoming} />
        </div>
      </div>

      {/* Section 2 — KPIs */}
      <div className="mb-6">
        <SectionLabel>Sales Performance</SectionLabel>
        <KPISection kpis={data.kpis} />
      </div>

      {/* Section 3 — Pipeline health */}
      <div className="mb-6">
        <SectionLabel>Pipeline Health</SectionLabel>
        <PipelineHealthCard
          stages={data.pipelineHealth.stages}
          totalLeads={data.pipelineHealth.totalLeads}
          overdueCount={data.pipelineHealth.overdueCount}
        />
      </div>

      {/* Sections 4 & 5 — Superadmin only */}
      {data.teamActivity && data.lostReasons && (
        <>
          <div className="mb-6">
            <SectionLabel>Team Activity</SectionLabel>
            <TeamActivityCard team={data.teamActivity} />
          </div>

          <div className="mb-6">
            <SectionLabel>Lost Reason Analysis</SectionLabel>
            <LostReasonCard reasons={data.lostReasons} />
          </div>
        </>
      )}
    </div>
  );
}