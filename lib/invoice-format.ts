/** Client-safe invoice helpers — no Prisma / Node-only imports. */

export const CLOSED_WON = "Closed Won";
export const REMINDER_DAYS = 3;

export type Decimalish = { toString(): string } | number | string | null | undefined;

export function toNumber(value: Decimalish) {
  if (value == null) return 0;
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value) || 0;
  return Number(value.toString()) || 0;
}

export function money(value: Decimalish) {
  return toNumber(value).toFixed(2);
}

export function formatMoney(value: Decimalish, currency = "LKR") {
  const amount = toNumber(value);
  return `${amount.toLocaleString("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
}

export function computeLineTotal(qty: number, unitPrice: number) {
  return Math.round(qty * unitPrice * 100) / 100;
}

export function validateDiscountPercent(discountPercent: number) {
  if (!Number.isFinite(discountPercent) || discountPercent < 0 || discountPercent > 20) {
    return "Discount percentage must be between 0 and 20";
  }
  return null;
}

export function computeInvoiceTotals(
  lines: Array<{ qty: number; unitPrice: number }>,
  discountPercent = 0,
) {
  const safePercent = Math.min(Math.max(discountPercent, 0), 20);
  const subtotal = Math.round(
    lines.reduce((sum, line) => sum + computeLineTotal(line.qty, line.unitPrice), 0) * 100,
  ) / 100;
  const discount = Math.round(subtotal * (safePercent / 100) * 100) / 100;
  const total = Math.round((subtotal - discount) * 100) / 100;
  return { subtotal, discountPercent: safePercent, discountAmount: discount, total };
}

export function parseDateOnly(value: string | Date) {
  if (value instanceof Date) {
    return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());
  if (!match) return null;
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
}

export function toDateInput(value: Date | string | null | undefined) {
  if (!value) return "";
  const date = typeof value === "string" ? parseDateOnly(value) : parseDateOnly(value);
  if (!date) return "";
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function nextBillingDate(preferredDay: number | null | undefined, from = new Date()) {
  const day = Math.min(Math.max(Math.floor(preferredDay || 1), 1), 31);
  const year = from.getFullYear();
  const month = from.getMonth();
  const candidateDay = Math.min(day, new Date(Date.UTC(year, month + 1, 0)).getUTCDate());
  const candidate = new Date(Date.UTC(year, month, candidateDay));
  const today = new Date(Date.UTC(from.getFullYear(), from.getMonth(), from.getDate()));
  if (candidate >= today) return candidate;
  const nextCandidateDay = Math.min(day, new Date(Date.UTC(year, month + 2, 0)).getUTCDate());
  return new Date(Date.UTC(year, month + 1, nextCandidateDay));
}

export function formatInvoiceNumber(sequence: number) {
  return `DL-${new Date().getUTCFullYear()}-${String(sequence).padStart(3, "0")}`;
}

export type InvoiceStatusValue = "draft" | "sent" | "part_paid" | "paid" | "void";

export function effectiveDisplayStatus(
  status: InvoiceStatusValue,
  dueDate: Date,
  today = new Date(),
) {
  if (status !== "sent" && status !== "part_paid") return status;
  const due = parseDateOnly(dueDate)!;
  const now = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
  if (due < now) return "overdue";
  const soon = new Date(now);
  soon.setUTCDate(soon.getUTCDate() + REMINDER_DAYS);
  if (due <= soon) return "due_soon";
  return status;
}

export function displayStatusLabel(status: string) {
  switch (status) {
    case "sent":
    case "issued":
      return "Sent";
    case "part_paid":
      return "Part-paid";
    case "due_soon":
      return "Due soon";
    case "draft":
      return "Draft";
    case "paid":
      return "Paid";
    case "void":
      return "Void";
    case "overdue":
      return "Overdue";
    case "dismiss":
      return "Dismiss";
    default:
      return status.replace(/_/g, " ");
  }
}

export function billingMonthFromDate(value: Date | string) {
  const date = parseDateOnly(value);
  if (!date) return null;
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

export function billingTypeLabel(value: string | null | undefined) {
  switch (value) {
    case "monthly_retainer":
      return "Monthly Retainer";
    case "both":
      return "Both";
    case "one_time_development":
    default:
      return "One-time Development";
  }
}

export function formatBillingMonth(value: string | Date) {
  const date = typeof value === "string" ? parseDateOnly(value) : parseDateOnly(value);
  if (!date) return "—";
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
}

export function formatDaysLateLabel(daysLate: number, displayStatus: string) {
  if (displayStatus === "overdue" && daysLate > 0) return `${daysLate} day${daysLate === 1 ? "" : "s"} overdue`;
  if (daysLate > 0) return `${daysLate} day${daysLate === 1 ? "" : "s"} late`;
  return "0";
}

export function calculateDaysLate(dueDate: Date, paidDate: Date) {
  const due = parseDateOnly(dueDate)!;
  const paid = parseDateOnly(paidDate)!;
  return Math.max(0, Math.round((paid.getTime() - due.getTime()) / 86400000));
}

export function calculateDaysOverdue(dueDate: Date, today = new Date()) {
  return calculateDaysLate(dueDate, today);
}

export function profileIsCompleteForNewClient(profile: {
  clientType: "new" | "existing";
  billToName: string | null;
  billToCompany: string | null;
  billToLine1: string | null;
  billToCity?: string | null;
  billToPostal?: string | null;
}) {
  if (profile.clientType !== "new") return true;
  return Boolean(
    profile.billToName?.trim()
      && profile.billToCompany?.trim()
      && profile.billToLine1?.trim()
      && profile.billToCity?.trim()
      && profile.billToPostal?.trim(),
  );
}
