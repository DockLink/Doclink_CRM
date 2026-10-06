export const MONTHLY_REVENUE_LABEL = "Monthly Revenue";
export const DISCOVERY_CALL_LABEL = "Discovery Call";

export const REVENUE_CURRENCIES = ["Rs", "$"] as const;
export type RevenueCurrency = (typeof REVENUE_CURRENCIES)[number];

export const YES_NO_OPTIONS = ["Yes", "No"] as const;
export type YesNo = (typeof YES_NO_OPTIONS)[number];

export type StandardFieldKey = "monthlyRevenue" | "discoveryCall";

export interface MonthlyRevenue {
  currency: RevenueCurrency;
  amount: string;
}

// Stored as "<currency> <amount>", e.g. "Rs 50000" or "$ 1200".
export function formatMonthlyRevenue({ currency, amount }: MonthlyRevenue) {
  const clean = amount.replace(/[^0-9.]/g, "");
  return clean ? `${currency} ${clean}` : "";
}

export function parseMonthlyRevenue(value: string, fallback: RevenueCurrency = "Rs"): MonthlyRevenue {
  const raw = value.trim();
  const lower = raw.toLowerCase();
  const currency: RevenueCurrency = raw.includes("$") || /\busd\b/.test(lower)
    ? "$"
    : raw.includes("₹") || /\b(rs|inr)\b/.test(lower)
      ? "Rs"
      : fallback;
  const amount = raw.replace(/rs\.?|inr|usd/gi, "").replace(/[^0-9.]/g, "");
  return { currency, amount };
}

export function parseYesNo(value: unknown): YesNo | "" {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (["yes", "y", "true", "1", "done", "completed"].includes(normalized)) return "Yes";
  if (["no", "n", "false", "0", "pending"].includes(normalized)) return "No";
  return "";
}
