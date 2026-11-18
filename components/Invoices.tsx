"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  calculateDaysOverdue,
  displayStatusLabel,
  formatBillingMonth,
  formatMoney,
} from "@/lib/invoice-format";
import { notifyCrmDataChanged, onCrmDataChanged } from "@/lib/crm-invalidation";
import { ClientInvoiceFolders } from "@/components/ClientInvoiceFolders";
import { InvoiceSettingsPanel } from "@/components/InvoiceSettingsPanel";

export type InvoiceListItem = {
  id: string;
  invoiceNumber: string | null;
  status: "draft" | "sent" | "issued" | "part_paid" | "paid" | "void";
  displayStatus: string;
  clientType: "new" | "existing";
  invoiceType?: string;
  isMonthlyRetainer?: boolean;
  invoiceDate: string;
  dueDate: string;
  currency: string;
  total: string;
  amountPaid?: string;
  outstanding?: string;
  daysLate?: number;
  billToCompany: string | null;
  billToName: string | null;
  invoiceClientId?: string;
  lead?: { id: string; company: string; contact: string | null };
  invoiceClient?: { id: string; companyName: string; contactPerson: string | null };
  payments?: Array<{
    id: string;
    amount: string;
    paymentDate: string;
    daysLate: number;
    notes: string | null;
  }>;
};

type Kpis = {
  draft: number;
  issued: number;
  sent?: number;
  partPaid: number;
  paid: number;
  void: number;
  overdue: number;
  dueSoon: number;
  total: number;
  totalInvoiced?: string;
  totalPaid?: string;
  outstanding?: string;
};

type ReminderSummary = {
  overdue: number;
  dueToday: number;
  dueSoon: number;
  recurringDrafts: number;
  reminders: number;
  total: number;
  items: {
    overdue: InvoiceListItem[];
    dueToday: InvoiceListItem[];
    dueSoon: InvoiceListItem[];
    recurringDrafts: InvoiceListItem[];
    reminders: InvoiceListItem[];
  };
};

type InvoiceTab = "overview" | "clients" | "recurring" | "payments" | "reminders" | "settings";

const TABS: Array<{ id: InvoiceTab; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "clients", label: "Clients" },
  { id: "recurring", label: "Recurring" },
  { id: "payments", label: "Payments" },
  { id: "reminders", label: "Reminders" },
  { id: "settings", label: "Settings" },
];

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  draft: { bg: "#F1F5F9", color: "#64748B" },
  sent: { bg: "#DBEAFE", color: "#1D4ED8" },
  issued: { bg: "#DBEAFE", color: "#1D4ED8" },
  part_paid: { bg: "#FFEDD5", color: "#C2410C" },
  paid: { bg: "#DCFCE7", color: "#15803D" },
  void: { bg: "#F3F4F6", color: "#6B7280" },
  overdue: { bg: "#FEE2E2", color: "#B91C1C" },
  due_soon: { bg: "#FEF3C7", color: "#B45309" },
};

function StatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLE[status] ?? STATUS_STYLE.draft;
  return (
    <span className="px-2.5 py-1 rounded-full text-xs font-bold" style={{ background: style.bg, color: style.color }}>
      {displayStatusLabel(status)}
    </span>
  );
}

function KpiCard({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <div className="rounded-xl px-4 py-3" style={{ background: "#FFFFFF", border: "1px solid #E3E7EF" }}>
      <p style={{ fontSize: 11, fontWeight: 700, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</p>
      <p style={{ fontSize: 28, fontWeight: 700, color: accent, marginTop: 4 }}>{value}</p>
    </div>
  );
}

function attentionDetail(item: InvoiceListItem & { attention: string }) {
  const outstanding = formatMoney(item.outstanding ?? item.total, item.currency);
  if (item.attention === "Overdue") {
    const days = item.daysLate ?? calculateDaysOverdue(new Date(`${item.dueDate}T00:00:00.000Z`));
    return `Overdue by ${days} day${days === 1 ? "" : "s"} · ${outstanding} outstanding.`;
  }
  if (item.attention === "Due soon" || item.attention === "Due today") {
    const days = Math.max(0, Math.round((new Date(`${item.dueDate}T00:00:00.000Z`).getTime() - Date.UTC(new Date().getFullYear(), new Date().getMonth(), new Date().getDate())) / 86400000));
    if (item.attention === "Due today") return `Due today · ${outstanding} outstanding.`;
    return `Due in ${days} day${days === 1 ? "" : "s"} · ${outstanding} outstanding.`;
  }
  if (item.attention === "Recurring draft") return "New recurring invoice draft generated.";
  if (item.attention === "Reminder") return `Payment reminder not yet sent · ${outstanding} outstanding.`;
  return outstanding;
}

export function Invoices() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const clientFilter = searchParams.get("clientId") ?? searchParams.get("leadId") ?? "";
  const tabParam = searchParams.get("tab") as InvoiceTab | null;
  const activeTab: InvoiceTab = TABS.some((tab) => tab.id === tabParam) ? (tabParam as InvoiceTab) : "overview";

  const [invoices, setInvoices] = useState<InvoiceListItem[]>([]);
  const [kpis, setKpis] = useState<Kpis>({ draft: 0, issued: 0, partPaid: 0, paid: 0, void: 0, overdue: 0, dueSoon: 0, total: 0 });
  const [reminders, setReminders] = useState<ReminderSummary | null>(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [yearFilter, setYearFilter] = useState(String(new Date().getFullYear()));
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const setTab = (tab: InvoiceTab) => {
    const params = new URLSearchParams(searchParams.toString());
    if (tab === "overview") params.delete("tab");
    else params.set("tab", tab);
    const qs = params.toString();
    router.replace(qs ? `/invoices?${qs}` : "/invoices");
  };

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      if (clientFilter) params.set("invoiceClientId", clientFilter);
      if (query.trim()) params.set("q", query.trim());
      const [recurringRes, listRes, reminderRes] = await Promise.all([
        fetch("/api/invoices/recurring/generate", { method: "POST" }),
        fetch(`/api/invoices?${params.toString()}`),
        fetch("/api/invoices/reminders/summary"),
      ]);
      if (!recurringRes.ok) {
        const recurringResult = await recurringRes.json() as { error?: string };
        throw new Error(recurringResult.error ?? "Unable to prepare recurring invoice drafts.");
      }
      const listResult = await listRes.json() as { invoices?: InvoiceListItem[]; kpis?: Kpis; error?: string };
      const reminderResult = await reminderRes.json() as ReminderSummary & { error?: string };
      if (!listRes.ok) throw new Error(listResult.error ?? "Unable to load invoices.");
      setInvoices(listResult.invoices ?? []);
      if (listResult.kpis) setKpis(listResult.kpis);
      if (reminderRes.ok) setReminders(reminderResult);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load invoices.");
    } finally {
      setLoading(false);
    }
  }, [clientFilter, query, statusFilter]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  useEffect(() => onCrmDataChanged(["invoices", "notifications"], () => void load()), [load]);

  const years = useMemo(() => {
    const values = new Set(invoices.map((invoice) => invoice.invoiceDate.slice(0, 4)).filter(Boolean));
    values.add(String(new Date().getFullYear()));
    return [...values].sort((a, b) => Number(b) - Number(a));
  }, [invoices]);

  const filteredInvoices = useMemo(() => {
    if (!yearFilter) return invoices;
    return invoices.filter((invoice) => invoice.invoiceDate.startsWith(yearFilter));
  }, [invoices, yearFilter]);

  const attentionItems = useMemo(() => {
    if (!reminders) return [];
    return [
      ...reminders.items.overdue.map((item) => ({ ...item, attention: "Overdue" as const })),
      ...reminders.items.dueSoon.map((item) => ({ ...item, attention: "Due soon" as const })),
      ...reminders.items.dueToday.map((item) => ({ ...item, attention: "Due today" as const })),
      ...reminders.items.recurringDrafts.map((item) => ({ ...item, attention: "Recurring draft" as const })),
      ...reminders.items.reminders
        .filter((item) => !reminders.items.overdue.some((overdue) => overdue.id === item.id)
          && !reminders.items.dueSoon.some((soon) => soon.id === item.id)
          && !reminders.items.dueToday.some((today) => today.id === item.id))
        .map((item) => ({ ...item, attention: "Reminder" as const })),
    ];
  }, [reminders]);

  const recurringClients = useMemo(() => {
    const map = new Map<string, {
      leadId: string;
      company: string;
      contact: string | null;
      lastInvoice: InvoiceListItem | null;
      draftInvoice: InvoiceListItem | null;
    }>();
    for (const invoice of invoices) {
      const client = invoice.invoiceClient
        ? { id: invoice.invoiceClient.id, company: invoice.invoiceClient.companyName, contact: invoice.invoiceClient.contactPerson }
        : invoice.lead;
      if (!client || !invoice.isMonthlyRetainer) continue;
      const current = map.get(client.id) ?? {
        leadId: client.id,
        company: client.company,
        contact: client.contact,
        lastInvoice: null,
        draftInvoice: null,
      };
      if (invoice.status === "draft") {
        if (!current.draftInvoice || invoice.invoiceDate > current.draftInvoice.invoiceDate) {
          current.draftInvoice = invoice;
        }
      } else if (!current.lastInvoice || invoice.invoiceDate > current.lastInvoice.invoiceDate) {
        current.lastInvoice = invoice;
      }
      map.set(client.id, current);
    }
    return [...map.values()].sort((a, b) => a.company.localeCompare(b.company));
  }, [invoices]);

  const paymentRows = useMemo(() => {
    return invoices
      .flatMap((invoice) => (invoice.payments ?? []).map((payment) => ({
        ...payment,
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        client: invoice.invoiceClient?.companyName ?? invoice.lead?.company ?? invoice.billToCompany ?? "Client",
        currency: invoice.currency,
      })))
      .sort((a, b) => b.paymentDate.localeCompare(a.paymentDate));
  }, [invoices]);

  const dismissReminder = async (id: string) => {
    await fetch(`/api/invoices/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reminderDismissedAt: new Date().toISOString() }),
    });
    notifyCrmDataChanged("invoices", "notifications");
    void load();
  };

  return (
    <div className="flex flex-col gap-5" style={{ padding: 24 }}>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "#111111" }}>Invoices</h2>
          <p style={{ fontSize: 13, color: "#6B7280", marginTop: 4 }}>
            Invoice Dashboard
            {clientFilter ? " · Filtered to one invoice client." : ""}
          </p>
        </div>
        <Link
          href={clientFilter ? `/invoices/new?clientId=${clientFilter}` : "/invoices/new"}
          className="rounded-lg px-4 font-semibold"
          style={{
            height: 36,
            display: "inline-flex",
            alignItems: "center",
            background: "#2FBEB3",
            color: "#FFFFFF",
            textDecoration: "none",
            fontSize: 13,
          }}
        >
          + New Invoice
        </Link>
      </div>

      <div className="flex gap-1 flex-wrap" style={{ borderBottom: "1px solid #E5E7EB" }}>
        {TABS.map((tab) => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setTab(tab.id)}
              className="px-3 py-2 font-semibold"
              style={{
                fontSize: 13,
                background: "none",
                border: "none",
                borderBottom: active ? "2px solid #0E7A70" : "2px solid transparent",
                color: active ? "#0E7A70" : "#6B7280",
                cursor: "pointer",
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === "clients" && <ClientInvoiceFolders />}
      {activeTab === "settings" && <InvoiceSettingsPanel embedded />}

      {activeTab === "recurring" && (
        <div className="flex flex-col gap-4">
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 700 }}>Recurring retainers</h3>
            <p style={{ fontSize: 13, color: "#6B7280", marginTop: 4 }}>Monthly retainer clients and their next draft invoices.</p>
          </div>
          <div className="rounded-xl overflow-hidden" style={{ background: "#FFFFFF", border: "1px solid #E3E7EF" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#F9FAFB" }}>
                  {["Client", "Last invoice", "Next draft", ""].map((heading) => (
                    <th key={heading || "actions"} className="text-left" style={{ padding: "10px 16px", fontSize: 11, color: "#6B7280", textTransform: "uppercase" }}>{heading}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recurringClients.length === 0 && (
                  <tr><td colSpan={4} style={{ padding: 24, color: "#6B7280", fontSize: 13 }}>No monthly retainer clients yet. Enable recurring on a client folder.</td></tr>
                )}
                {recurringClients.map((client) => (
                  <tr key={client.leadId} style={{ borderTop: "1px solid #F3F4F6" }}>
                    <td style={{ padding: "12px 16px" }}>
                      <Link href={`/invoices/clients/${client.leadId}`} style={{ color: "#0E7A70", fontWeight: 600, textDecoration: "none" }}>{client.company}</Link>
                      <div style={{ fontSize: 12, color: "#6B7280" }}>{client.contact ?? "—"}</div>
                    </td>
                    <td style={{ padding: "12px 16px", fontSize: 13 }}>
                      {client.lastInvoice ? `${client.lastInvoice.invoiceNumber} · ${formatBillingMonth(client.lastInvoice.invoiceDate)}` : "—"}
                    </td>
                    <td style={{ padding: "12px 16px", fontSize: 13 }}>
                      {client.draftInvoice ? (
                        <Link href={`/invoices/${client.draftInvoice.id}`} style={{ color: "#0E7A70", fontWeight: 600 }}>{client.draftInvoice.invoiceNumber}</Link>
                      ) : "No draft yet"}
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <Link href={`/invoices/clients/${client.leadId}`} style={{ fontSize: 12, color: "#0E7A70", fontWeight: 600 }}>Open folder</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "payments" && (
        <div className="rounded-xl overflow-hidden" style={{ background: "#FFFFFF", border: "1px solid #E3E7EF" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#F9FAFB" }}>
                {["Date", "Invoice", "Client", "Amount", "Days late", "Notes"].map((heading) => (
                  <th key={heading} className="text-left" style={{ padding: "10px 16px", fontSize: 11, color: "#6B7280", textTransform: "uppercase" }}>{heading}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paymentRows.length === 0 && (
                <tr><td colSpan={6} style={{ padding: 24, color: "#6B7280", fontSize: 13 }}>No payments recorded yet.</td></tr>
              )}
              {paymentRows.map((payment) => (
                <tr key={payment.id} style={{ borderTop: "1px solid #F3F4F6" }}>
                  <td style={{ padding: "12px 16px", fontSize: 13 }}>{payment.paymentDate}</td>
                  <td style={{ padding: "12px 16px" }}>
                    <Link href={`/invoices/${payment.invoiceId}`} style={{ color: "#0E7A70", fontWeight: 600 }}>{payment.invoiceNumber}</Link>
                  </td>
                  <td style={{ padding: "12px 16px", fontSize: 13 }}>{payment.client}</td>
                  <td style={{ padding: "12px 16px", fontSize: 13, fontWeight: 600 }}>{formatMoney(payment.amount, payment.currency)}</td>
                  <td style={{ padding: "12px 16px", fontSize: 13 }}>{payment.daysLate}</td>
                  <td style={{ padding: "12px 16px", fontSize: 13, color: "#6B7280" }}>{payment.notes || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === "reminders" && (
        <div className="rounded-xl overflow-hidden" style={{ background: "#FFFFFF", border: "1px solid #FECACA" }}>
          <div className="px-4 py-3" style={{ background: "#FEF2F2", borderBottom: "1px solid #FECACA" }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, color: "#B91C1C" }}>Reminders & attention ({attentionItems.length})</h3>
          </div>
          <div className="divide-y" style={{ borderColor: "#F3F4F6" }}>
            {attentionItems.length === 0 && (
              <div style={{ padding: 24, color: "#6B7280", fontSize: 13 }}>Nothing needs attention right now.</div>
            )}
            {attentionItems.map((item) => (
              <div key={`reminders-${item.attention}-${item.id}`} className="px-4 py-3 flex items-center justify-between gap-3">
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{item.invoiceNumber ?? "Draft"} · {item.invoiceClient?.companyName ?? item.lead?.company ?? item.billToCompany ?? "Client"}</div>
                  <div style={{ fontSize: 12, color: "#6B7280", marginTop: 2 }}><StatusBadge status={item.displayStatus} /> <span style={{ marginLeft: 8 }}>{attentionDetail(item)}</span></div>
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => router.push(`/invoices/${item.id}`)} className="rounded-lg px-3 font-semibold" style={{ height: 30, fontSize: 11, background: "#2FBEB3", color: "#FFFFFF", border: "none" }}>View invoice</button>
                  <button type="button" onClick={() => void dismissReminder(item.id)} className="rounded-lg px-2.5 font-semibold" style={{ height: 30, fontSize: 11, background: "#F9FAFB", color: "#6B7280", border: "1px solid #E5E7EB" }}>Dismiss</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === "overview" && (
        <>
          <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))" }}>
            <div className="rounded-xl px-4 py-3" style={{ background: "#FFFFFF", border: "1px solid #E3E7EF" }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: "#6B7280", textTransform: "uppercase" }}>Total Invoiced</p>
              <p style={{ fontSize: 22, fontWeight: 700, marginTop: 4 }}>{formatMoney(kpis.totalInvoiced ?? 0)}</p>
            </div>
            <div className="rounded-xl px-4 py-3" style={{ background: "#FFFFFF", border: "1px solid #E3E7EF" }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: "#6B7280", textTransform: "uppercase" }}>Total Paid</p>
              <p style={{ fontSize: 22, fontWeight: 700, color: "#16A34A", marginTop: 4 }}>{formatMoney(kpis.totalPaid ?? 0)}</p>
            </div>
            <div className="rounded-xl px-4 py-3" style={{ background: "#FFFFFF", border: "1px solid #E3E7EF" }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: "#6B7280", textTransform: "uppercase" }}>Outstanding</p>
              <p style={{ fontSize: 22, fontWeight: 700, color: "#DC2626", marginTop: 4 }}>{formatMoney(kpis.outstanding ?? 0)}</p>
            </div>
            <KpiCard label="Overdue" value={kpis.overdue} accent="#DC2626" />
            <KpiCard label="Draft" value={kpis.draft} accent="#64748B" />
            <KpiCard label="Due Soon" value={kpis.dueSoon} accent="#D97706" />
            <KpiCard label="Sent" value={kpis.sent ?? kpis.issued} accent="#1D4ED8" />
            <KpiCard label="Part-Paid" value={kpis.partPaid} accent="#C2410C" />
          </div>

          {attentionItems.length > 0 && (
            <div className="rounded-xl overflow-hidden" style={{ background: "#FFFFFF", border: "1px solid #FECACA" }}>
              <div className="px-4 py-3 flex items-center justify-between" style={{ background: "#FEF2F2", borderBottom: "1px solid #FECACA" }}>
                <h3 style={{ fontSize: 13, fontWeight: 700, color: "#B91C1C" }}>
                  Needs attention ({reminders?.total ?? attentionItems.length})
                </h3>
              </div>
              <div className="divide-y" style={{ borderColor: "#F3F4F6" }}>
                {attentionItems.map((item) => (
                  <div key={`${item.attention}-${item.id}`} className="px-4 py-3 flex items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <StatusBadge status={item.attention === "Recurring draft" ? "draft" : item.displayStatus} />
                        <span style={{ fontSize: 13, fontWeight: 600, color: "#111111" }}>
                          {item.invoiceNumber ?? "Draft"} · {item.invoiceClient?.companyName ?? item.lead?.company ?? item.billToCompany ?? "Client"}
                        </span>
                      </div>
                      <div style={{ fontSize: 12, color: "#6B7280", marginTop: 4 }}>
                        {attentionDetail(item)}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => router.push(`/invoices/${item.id}`)}
                      className="rounded-lg px-3 font-semibold shrink-0"
                      style={{ height: 30, fontSize: 11, background: "#2FBEB3", color: "#FFFFFF", border: "none" }}
                    >
                      View invoice
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center gap-3 flex-wrap">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search invoice # or client"
              className="rounded-lg px-3"
              style={{ height: 36, width: 260, border: "1.5px solid #E3E7EF", fontSize: 13, outline: "none" }}
            />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-lg px-3"
              style={{ height: 36, border: "1.5px solid #E3E7EF", fontSize: 13, background: "#FFFFFF" }}
            >
              <option value="">All statuses</option>
              <option value="draft">Draft</option>
              <option value="sent">Sent</option>
              <option value="part_paid">Part-paid</option>
              <option value="paid">Paid</option>
              <option value="void">Void</option>
            </select>
            <select
              value={yearFilter}
              onChange={(e) => setYearFilter(e.target.value)}
              className="rounded-lg px-3"
              style={{ height: 36, border: "1.5px solid #E3E7EF", fontSize: 13, background: "#FFFFFF" }}
            >
              <option value="">All years</option>
              {years.map((year) => <option key={year} value={year}>{year}</option>)}
            </select>
            {clientFilter && (
              <Link href="/invoices" style={{ fontSize: 12, color: "#0E7A70", fontWeight: 600 }}>
                Clear client filter
              </Link>
            )}
          </div>

          <div className="rounded-xl overflow-hidden" style={{ background: "#FFFFFF", border: "1px solid #E3E7EF" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#F9FAFB", borderBottom: "1px solid #E3E7EF" }}>
                  {["Invoice Number", "Client", "Invoice Type", "Billing Month", "Invoice Date", "Due Date", "Total (LKR)", "Paid Amount", "Outstanding", "Status"].map((heading) => (
                    <th key={heading} className="text-left" style={{ padding: "10px 12px", fontSize: 11, fontWeight: 700, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.04em", whiteSpace: "nowrap" }}>
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr><td colSpan={10} style={{ padding: 24, textAlign: "center", color: "#6B7280", fontSize: 13 }}>Loading invoices…</td></tr>
                )}
                {!loading && error && (
                  <tr><td colSpan={10} style={{ padding: 24, textAlign: "center", color: "#DC2626", fontSize: 13 }}>{error}</td></tr>
                )}
                {!loading && !error && filteredInvoices.length === 0 && (
                  <tr><td colSpan={10} style={{ padding: 24, textAlign: "center", color: "#6B7280", fontSize: 13 }}>No invoices yet.</td></tr>
                )}
                {!loading && !error && filteredInvoices.map((invoice, index) => (
                  <tr
                    key={invoice.id}
                    onClick={() => router.push(`/invoices/${invoice.id}`)}
                    style={{
                      borderBottom: index < filteredInvoices.length - 1 ? "1px solid #F3F4F6" : "none",
                      cursor: "pointer",
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = "#E3F7F5"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                  >
                    <td style={{ padding: "12px", fontSize: 13, fontWeight: 600, color: "#0E7A70" }}>
                      {invoice.invoiceNumber ?? "Draft"}
                    </td>
                    <td style={{ padding: "12px", fontSize: 13, color: "#374151" }}>
                      {(invoice.invoiceClient || invoice.lead) ? (
                        <Link
                          href={`/invoices/clients/${invoice.invoiceClient?.id ?? invoice.lead!.id}`}
                          onClick={(event) => event.stopPropagation()}
                          style={{ color: "#0E7A70", textDecoration: "none" }}
                        >
                          {invoice.invoiceClient?.companyName ?? invoice.lead?.company}
                        </Link>
                      ) : invoice.billToCompany ?? "—"}
                    </td>
                    <td style={{ padding: "12px", fontSize: 12, color: "#6B7280" }}>
                      {invoice.invoiceType ?? (invoice.clientType === "existing" ? "Monthly Retainer" : "Development")}
                    </td>
                    <td style={{ padding: "12px", fontSize: 12, color: "#6B7280" }}>
                      {formatBillingMonth(invoice.invoiceDate)}
                    </td>
                    <td style={{ padding: "12px", fontSize: 12, color: "#6B7280" }}>{invoice.invoiceDate}</td>
                    <td style={{ padding: "12px", fontSize: 12, color: "#6B7280" }}>{invoice.dueDate}</td>
                    <td style={{ padding: "12px", fontSize: 13, fontWeight: 700, color: "#111111" }}>
                      {formatMoney(invoice.total, invoice.currency)}
                    </td>
                    <td style={{ padding: "12px", fontSize: 13, color: "#374151" }}>
                      {formatMoney(invoice.amountPaid ?? "0", invoice.currency)}
                    </td>
                    <td style={{ padding: "12px", fontSize: 13, fontWeight: 600, color: Number(invoice.outstanding ?? 0) > 0 ? "#B91C1C" : "#374151" }}>
                      {formatMoney(invoice.outstanding ?? "0", invoice.currency)}
                    </td>
                    <td style={{ padding: "12px" }}>
                      <StatusBadge status={invoice.displayStatus} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
