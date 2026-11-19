export type UserRole = "superadmin" | "admin";

export type AppPage =
  | "dashboard"
  | "pipeline-kanban"
  | "pipeline-list"
  | "followups"
  | "invoices"
  | "invoice-detail"
  | "invoice-new"
  | "settings"
  | "profile"
  | "lead-detail"
  | "add-lead"
  | "bulk-import";

export const PAGE_ROUTES: Record<AppPage, string> = {
  dashboard: "/dashboard",
  "pipeline-kanban": "/pipeline/kanban",
  "pipeline-list": "/pipeline/list",
  followups: "/followups",
  invoices: "/invoices",
  "invoice-detail": "/invoices",
  "invoice-new": "/invoices/new",
  settings: "/settings",
  profile: "/profile",
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
  "/invoices": "Invoices",
  "/invoices/new": "New Invoice",
  "/settings": "Settings",
  "/profile": "Profile",
  "/leads/new": "Add Lead",
};

export function pathnameToPage(pathname: string): AppPage {
  if (pathname.startsWith("/pipeline/bulk-import")) return "bulk-import";
  if (pathname.startsWith("/pipeline/kanban")) return "pipeline-kanban";
  if (pathname.startsWith("/pipeline/list")) return "pipeline-list";
  if (pathname.startsWith("/followups")) return "followups";
  if (pathname.startsWith("/invoices/new")) return "invoice-new";
  if (pathname.startsWith("/invoices/")) return "invoice-detail";
  if (pathname.startsWith("/invoices")) return "invoices";
  if (pathname.startsWith("/settings")) return "settings";
  if (pathname.startsWith("/profile")) return "profile";
  if (pathname.startsWith("/leads/new")) return "add-lead";
  if (pathname.startsWith("/leads/")) return "lead-detail";
  return "dashboard";
}

export function pageTitleForPath(pathname: string): string {
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname];
  if (pathname.startsWith("/invoices/clients/")) return "Invoice Client";
  if (pathname.startsWith("/invoices/clients")) return "Invoice Clients";
  if (pathname.startsWith("/invoices/recurring")) return "Recurring Invoices";
  if (pathname.startsWith("/invoices/payments")) return "Invoice Payments";
  if (pathname.startsWith("/invoices/reminders")) return "Invoice Reminders";
  if (pathname.startsWith("/invoices/settings")) return "Invoice Settings";
  if (pathname.startsWith("/invoices/") && pathname !== "/invoices/new") return "Invoice";
  if (pathname.startsWith("/leads/") && pathname !== "/leads/new") return "Lead Detail";
  return "DocLink CRM";
}
