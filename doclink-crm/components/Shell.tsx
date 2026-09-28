"use client";

import { useState, type ReactNode, type CSSProperties } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { PAGE_ROUTES, pageTitleForPath, pathnameToPage, type UserRole } from "@/lib/types";
import { useDisplayName, useRole } from "@/lib/role-context";

export type { UserRole };

// ─── Icons ────────────────────────────────────────────────────────────────────

function GridIcon({ active }: { active?: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: active ? "#0E7A70" : "#6B7280" }}>
      <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}
function KanbanIcon({ active }: { active?: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: active ? "#0E7A70" : "#6B7280" }}>
      <rect x="3" y="3" width="5" height="18" rx="1" /><rect x="10" y="3" width="5" height="13" rx="1" /><rect x="17" y="3" width="5" height="9" rx="1" />
    </svg>
  );
}
function ListIcon({ active }: { active?: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: active ? "#0E7A70" : "#6B7280" }}>
      <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
  );
}
function BellIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}
function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: "#9CA3AF" }}>
      <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}
function LogoutIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: "#9CA3AF" }}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}
function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      style={{ transform: open ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.15s", color: "#9CA3AF" }}>
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}
function SettingsIcon({ active }: { active?: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: active ? "#0E7A70" : "#6B7280" }}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}
function CalendarIcon({ active }: { active?: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: active ? "#0E7A70" : "#6B7280" }}>
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}
function ChevronDownIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ color: "#6B7280" }}>
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

// ─── Sidebar nav item ─────────────────────────────────────────────────────────

function NavItem({
  label,
  icon,
  active,
  href,
  indent = false,
}: {
  label: string;
  icon?: ReactNode;
  active: boolean;
  href: string;
  indent?: boolean;
}) {
  const style: CSSProperties = {
    height: 36,
    borderRadius: 6,
    paddingLeft: indent ? 32 : 12,
    paddingRight: 12,
    background: active ? "#E3F7F5" : "transparent",
    borderLeft: active ? "3px solid #2FBEB3" : "3px solid transparent",
    color: active ? "#0E7A70" : "#111111",
    fontWeight: active ? 500 : 400,
    fontSize: 14,
    textDecoration: "none",
  };

  return (
    <Link
      href={href}
      className="w-full flex items-center gap-2.5 text-left transition-all duration-100 relative"
      style={style}
      onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = "#F9FAFB"; }}
      onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = active ? "#E3F7F5" : "transparent"; }}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      {label}
    </Link>
  );
}

// ─── Sidebar ─────────────────────────────────────────────────────────────────

function initialsOf(name: string) {
  return (name || "").split(" ").filter(Boolean).map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "?";
}

function Sidebar({ role, name, onSignOut }: { role: UserRole; name: string; onSignOut: () => void }) {
  const pathname = usePathname();
  const page = pathnameToPage(pathname);
  const [pipelineOpen, setPipelineOpen] = useState(
    page === "pipeline-kanban" ||
      page === "pipeline-list" ||
      page === "lead-detail" ||
      page === "add-lead" ||
      page === "bulk-import"
  );

  const isPipeline =
    page === "pipeline-kanban" ||
    page === "pipeline-list" ||
    page === "lead-detail" ||
    page === "add-lead" ||
    page === "bulk-import";

  return (
    <aside
      className="fixed left-0 top-0 bottom-0 flex flex-col z-30"
      style={{ width: 240, background: "#FFFFFF", borderRight: "1px solid #E5E7EB" }}
    >
      <div className="flex items-center gap-2.5 px-4" style={{ height: 64, borderBottom: "1px solid #E5E7EB" }}>
        <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "#2FBEB3" }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
            <path d="M4 4h6v16H4zM14 4h6v16h-6z" fill="white" opacity="0.9" />
            <rect x="10" y="9" width="4" height="6" fill="white" opacity="0.5" />
          </svg>
        </div>
        <span style={{ fontSize: 16, fontWeight: 700, color: "#0E7A70", letterSpacing: "-0.3px" }}>DocLink CRM</span>
      </div>

      <nav className="flex-1 px-3 py-4 flex flex-col gap-0.5 overflow-y-auto">
        <NavItem
          label="Dashboard"
          icon={<GridIcon active={page === "dashboard"} />}
          active={page === "dashboard"}
          href={PAGE_ROUTES.dashboard}
        />

        <div>
          <button
            type="button"
            onClick={() => setPipelineOpen((v) => !v)}
            className="w-full flex items-center gap-2.5 text-left transition-all duration-100 relative"
            style={{
              height: 36, borderRadius: 6, paddingLeft: 12, paddingRight: 10,
              background: isPipeline ? "#E3F7F5" : "transparent",
              borderLeft: isPipeline ? "3px solid #2FBEB3" : "3px solid transparent",
              color: isPipeline ? "#0E7A70" : "#111111",
              fontWeight: isPipeline ? 500 : 400,
              fontSize: 14, cursor: "pointer", border: "none", outline: "none",
            }}
            onMouseEnter={(e) => { if (!isPipeline) e.currentTarget.style.background = "#F9FAFB"; }}
            onMouseLeave={(e) => { if (!isPipeline) e.currentTarget.style.background = "transparent"; }}
          >
            <span className="shrink-0"><KanbanIcon active={isPipeline} /></span>
            <span className="flex-1">Pipeline</span>
            <ChevronIcon open={pipelineOpen} />
          </button>
          {pipelineOpen && (
            <div className="mt-0.5 flex flex-col gap-0.5">
              <NavItem
                label="Kanban"
                icon={<KanbanIcon active={page === "pipeline-kanban"} />}
                active={page === "pipeline-kanban"}
                href={PAGE_ROUTES["pipeline-kanban"]}
                indent
              />
              <NavItem
                label="List"
                icon={<ListIcon active={page === "pipeline-list"} />}
                active={page === "pipeline-list"}
                href={PAGE_ROUTES["pipeline-list"]}
                indent
              />
            </div>
          )}
        </div>

        <NavItem
          label="Follow-ups"
          icon={<CalendarIcon active={page === "followups"} />}
          active={page === "followups"}
          href={PAGE_ROUTES.followups}
        />

        {role === "superadmin" && (
          <>
            <div className="pt-4 pb-1.5 px-3">
              <span style={{ fontSize: 10, fontWeight: 600, color: "#9CA3AF", letterSpacing: "0.08em", textTransform: "uppercase" }}>Admin</span>
            </div>
            <NavItem
              label="Settings"
              icon={<SettingsIcon active={page === "settings"} />}
              active={page === "settings"}
              href={PAGE_ROUTES.settings}
            />
          </>
        )}
      </nav>

      <div className="px-3 py-3" style={{ borderTop: "1px solid #E5E7EB" }}>
        <div className="flex items-center gap-2.5">
          <Link
            href={PAGE_ROUTES.profile}
            className="flex items-center gap-2.5 flex-1 min-w-0 rounded-lg"
            style={{ textDecoration: "none", background: page === "profile" ? "#E3F7F5" : "transparent", padding: 4 }}
          >
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-white text-xs font-semibold"
              style={{ background: "#2FBEB3" }}
            >
              {initialsOf(name)}
            </div>
            <div className="flex-1 min-w-0">
              <div style={{ fontSize: 13, fontWeight: 500, color: "#111111" }} className="truncate">
                {name || "Account"}
              </div>
              <span
                className="inline-block px-1.5 py-0.5 rounded-full text-white"
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  background: role === "superadmin" ? "#0E7A70" : "#9CA3AF",
                  lineHeight: 1.4,
                }}
              >
                {role === "superadmin" ? "Superadmin" : "Admin"}
              </span>
            </div>
          </Link>
          <button
            type="button"
            onClick={onSignOut}
            className="shrink-0 hover:opacity-70 transition-opacity"
            aria-label="Sign out"
            style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}
          >
            <LogoutIcon />
          </button>
        </div>
      </div>
    </aside>
  );
}

// ─── Top bar ──────────────────────────────────────────────────────────────────

function TopBar({ pageTitle, name, onSignOut }: { pageTitle: string; name: string; onSignOut: () => void }) {
  const [notifOpen, setNotifOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);

  return (
    <header
      className="fixed top-0 right-0 flex items-center z-20"
      style={{ left: 240, height: 64, background: "#FFFFFF", borderBottom: "1px solid #E5E7EB", paddingLeft: 24, paddingRight: 24 }}
    >
      <h1 style={{ fontSize: 20, fontWeight: 600, color: "#111111", whiteSpace: "nowrap", marginRight: 24 }}>
        {pageTitle}
      </h1>

      <div className="flex-1 flex justify-center" style={{ maxWidth: 400 }}>
        <div className="relative w-full" style={{ maxWidth: 380 }}>
          <span className="absolute left-3 top-1/2 -translate-y-1/2">
            <SearchIcon />
          </span>
          <input
            type="text"
            placeholder="Search leads by company, contact, phone..."
            className="w-full h-9 pl-9 pr-3 text-sm rounded-lg border outline-none transition-all"
            style={{ borderColor: "#E5E7EB", color: "#111111", fontSize: 13 }}
            onFocus={(e) => { e.currentTarget.style.borderColor = "#2FBEB3"; e.currentTarget.style.boxShadow = "0 0 0 2px rgba(47,190,179,0.12)"; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = "#E5E7EB"; e.currentTarget.style.boxShadow = "none"; }}
          />
        </div>
      </div>

      <div className="flex items-center gap-2 ml-auto">
        <div className="relative">
          <button
            type="button"
            onClick={() => { setNotifOpen((v) => !v); setUserOpen(false); }}
            className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-[#F9FAFB] transition-colors relative"
            style={{ border: "1px solid #E5E7EB", cursor: "pointer", background: "white" }}
            aria-label="Notifications"
          >
            <BellIcon />
            <span
              className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full"
              style={{ background: "#DC2626", border: "1.5px solid white" }}
            />
          </button>
          {notifOpen && (
            <div
              className="absolute right-0 mt-1 rounded-xl shadow-lg border py-2"
              style={{ top: "100%", width: 300, background: "white", borderColor: "#E5E7EB", zIndex: 50 }}
            >
              <div className="px-4 py-2" style={{ borderBottom: "1px solid #E5E7EB" }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: "#111111" }}>Notifications</span>
              </div>
              {[
                { text: "3 follow-ups missed today", time: "2h ago", dot: "#DC2626" },
                { text: "Meridian Corp moved to Proposal Sent", time: "4h ago", dot: "#6366F1" },
                { text: "Weekly pipeline report ready", time: "Yesterday", dot: "#2FBEB3" },
              ].map(({ text, time, dot }) => (
                <div key={text} className="flex items-start gap-3 px-4 py-2.5 hover:bg-[#F9FAFB] transition-colors" style={{ cursor: "pointer" }}>
                  <div className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ background: dot }} />
                  <div>
                    <div style={{ fontSize: 13, color: "#111111" }}>{text}</div>
                    <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 2 }}>{time}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="relative">
          <button
            type="button"
            onClick={() => { setUserOpen((v) => !v); setNotifOpen(false); }}
            className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-lg hover:bg-[#F9FAFB] transition-colors"
            style={{ border: "1px solid #E5E7EB", cursor: "pointer", background: "white" }}
          >
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-semibold" style={{ background: "#2FBEB3" }}>
              {initialsOf(name)}
            </div>
            <ChevronDownIcon />
          </button>
          {userOpen && (
            <div
              className="absolute right-0 mt-1 rounded-xl shadow-lg border py-1.5"
              style={{ top: "100%", width: 180, background: "white", borderColor: "#E5E7EB", zIndex: 50 }}
            >
              <Link
                href={PAGE_ROUTES.profile}
                onClick={() => setUserOpen(false)}
                className="block w-full text-left px-4 py-2 hover:bg-[#F9FAFB] transition-colors"
                style={{ fontSize: 13, color: "#111111", textDecoration: "none" }}
              >
                Profile
              </Link>
              <button
                type="button"
                onClick={onSignOut}
                className="w-full text-left px-4 py-2 text-sm hover:bg-[#F9FAFB] transition-colors"
                style={{ fontSize: 13, color: "#DC2626", background: "none", border: "none", cursor: "pointer" }}
              >
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

// ─── Shell wrapper ────────────────────────────────────────────────────────────

export function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const role = useRole();
  const { name } = useDisplayName();
  const pageTitle = pageTitleForPath(pathname);
  const handleSignOut = async () => {
    await createClient().auth.signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <div className="min-h-screen" style={{ background: "#FAFAFA" }}>
      <Sidebar role={role} name={name} onSignOut={handleSignOut} />
      <TopBar pageTitle={pageTitle} name={name} onSignOut={handleSignOut} />
      <main style={{ marginLeft: 240, paddingTop: 64, minHeight: "100vh" }}>
        {children}
      </main>
    </div>
  );
}
