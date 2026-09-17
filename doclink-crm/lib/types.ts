export type UserRole = "superadmin" | "admin";

export type AppPage =
  | "dashboard"
  | "pipeline-kanban"
  | "pipeline-list"
  | "followups"
  | "settings"
  | "lead-detail"
  | "add-lead"
  | "bulk-import";

export const PAGE_ROUTES: Record<AppPage, string> = {
  dashboard: "/dashboard",
  "pipeline-kanban": "/pipeline/kanban",
  "pipeline-list": "/pipeline/list",
  followups: "/followups",
  settings: "/settings",
  "lead-detail": "/leads",
  "add-lead": "/leads/new",
  "bulk-import": "/pipeline/bulk-import",
};

export const PAGE_TITLES: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/pipeline/kanban": "Pipeline",
  "/pipeline/list": "Pipeline",
  "/pipeline/bulk-import": "Bulk Import",
  "/followups": "Follow-ups",
  "/settings": "Settings",
  "/leads/new": "Add Lead",
};

export function pathnameToPage(pathname: string): AppPage {
  if (pathname.startsWith("/pipeline/bulk-import")) return "bulk-import";
  if (pathname.startsWith("/pipeline/kanban")) return "pipeline-kanban";
  if (pathname.startsWith("/pipeline/list")) return "pipeline-list";
  if (pathname.startsWith("/followups")) return "followups";
  if (pathname.startsWith("/settings")) return "settings";
  if (pathname.startsWith("/leads/new")) return "add-lead";
  if (pathname.startsWith("/leads/")) return "lead-detail";
  return "dashboard";
}

export function pageTitleForPath(pathname: string): string {
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname];
  if (pathname.startsWith("/leads/") && pathname !== "/leads/new") return "Lead Detail";
  return "DocLink CRM";
}
