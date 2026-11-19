"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  displayStatusLabel,
  formatBillingMonth,
  formatDaysLateLabel,
  formatMoney,
} from "@/lib/invoice-format";
import { isRequiredClientField, isValidClientPhone, REQUIRED_CLIENT_FIELDS } from "@/lib/client-form-validation";

type FolderData = {
  client: {
    id: string;
    clientName: string;
    company: string;
    companyName: string;
    contact: string | null;
    contactPerson: string | null;
    email: string | null;
    phone: string | null;
    billingAddress: string | null;
    city: string | null;
    country: string | null;
    postalCode: string | null;
    notes: string | null;
    clientType?: "new" | "existing";
    billingType?: string;
    updatedAt?: string;
    recurringConfig?: {
      id: string;
      billingDay: number;
      status: "active" | "paused";
      monthlyAmount: string;
      discountPercent: string;
    } | null;
  };
  summary: { totalBilled: string; totalPaid: string; totalOutstanding: string; totalLateDays: number };
  years: number[];
  invoices: Array<{
    id: string;
    invoiceNumber: string | null;
    invoiceDate: string;
    billingMonth?: string;
    dueDate: string;
    total: string;
    amountPaid: string;
    outstanding: string;
    currency: string;
    displayStatus: string;
    tableStatus?: string;
    daysLate: number;
  }>;
};

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  draft: { bg: "#F1F5F9", color: "#64748B" },
  sent: { bg: "#DBEAFE", color: "#1D4ED8" },
  issued: { bg: "#DBEAFE", color: "#1D4ED8" },
  part_paid: { bg: "#FFEDD5", color: "#C2410C" },
  paid: { bg: "#DCFCE7", color: "#15803D" },
  void: { bg: "#F3F4F6", color: "#6B7280" },
  overdue: { bg: "#FEE2E2", color: "#B91C1C" },
  due_soon: { bg: "#FEF3C7", color: "#B45309" },
  dismiss: { bg: "#F3F4F6", color: "#4B5563" },
};

function StatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLE[status] ?? STATUS_STYLE.draft;
  return (
    <span className="px-2.5 py-1 rounded-full text-xs font-bold" style={{ background: style.bg, color: style.color }}>
      {displayStatusLabel(status)}
    </span>
  );
}

export function ClientInvoiceFolder({ clientId, leadId }: { clientId?: string; leadId?: string }) {
  const id = clientId ?? leadId ?? "";
  const [data, setData] = useState<FolderData | null>(null);
  const [filter, setFilter] = useState("");
  const [year, setYear] = useState("");
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [message, setMessage] = useState("");
  const [recurringSaving, setRecurringSaving] = useState(false);
  const [lateFeeInvoiceId, setLateFeeInvoiceId] = useState<string | null>(null);
  const [clientTypeSaving, setClientTypeSaving] = useState(false);
  const [clientDetailsSaving, setClientDetailsSaving] = useState(false);
  const [editingClientDetails, setEditingClientDetails] = useState(false);
  const [clientDetailErrors, setClientDetailErrors] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (filter) params.set("filter", filter);
    if (year) params.set("year", year);
    const response = await fetch(`/api/invoices/clients/${id}?${params}`);
    const result = await response.json() as FolderData & { error?: string };
    if (!response.ok) throw new Error(result.error ?? "Unable to load client invoices.");
    setData(result);
  }, [filter, id, year]);

  useEffect(() => {
    if (!id) return;
    void load().catch((err) => setLoadError(err instanceof Error ? err.message : "Unable to load client invoices."));
  }, [load, id]);

  if (loadError) return <div style={{ padding: 24, color: "#DC2626" }}>{loadError}</div>;
  if (!data) return <div style={{ padding: 24, color: "#6B7280" }}>Loading client folder…</div>;

  const recurring = data.client.recurringConfig;

  const saveRecurring = async (patch: { status?: "active" | "paused"; billingDay?: number; enable?: boolean }) => {
    setRecurringSaving(true);
    setActionError("");
    try {
      const response = await fetch("/api/invoices/recurring", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoiceClientId: id,
          billingDay: patch.billingDay ?? recurring?.billingDay ?? 1,
          monthlyAmount: recurring?.monthlyAmount ?? 0,
          discountPercent: recurring?.discountPercent ?? 0,
          status: patch.status ?? (patch.enable === false ? "paused" : "active"),
        }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Unable to update recurring settings.");
      await load();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Unable to update recurring settings.");
    } finally {
      setRecurringSaving(false);
    }
  };

  const saveClientType = async (clientType: "new" | "existing") => {
    setClientTypeSaving(true);
    setActionError("");
    try {
      const response = await fetch(`/api/invoices/clients/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientType }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Unable to update client type.");
      await load();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Unable to update client type.");
    } finally {
      setClientTypeSaving(false);
    }
  };

  const saveClientDetails = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const values = {
      clientName: String(form.get("clientName") ?? "").trim(),
      companyName: String(form.get("companyName") ?? "").trim(),
      phone: String(form.get("phone") ?? "").trim(),
      billingAddress: String(form.get("billingAddress") ?? "").trim(),
      city: String(form.get("city") ?? "").trim(),
    };
    const errors: Record<string, string> = {};
    for (const field of REQUIRED_CLIENT_FIELDS) {
      if (!values[field]) errors[field] = "This field is required.";
    }
    if (values.phone && !isValidClientPhone(values.phone)) {
      errors.phone = "Enter a valid Sri Lankan or international phone number.";
    }
    if (Object.keys(errors).length > 0) {
      setClientDetailErrors(errors);
      return;
    }

    setClientDetailsSaving(true);
    setActionError("");
    setMessage("");
    setClientDetailErrors({});
    try {
      const response = await fetch(`/api/invoices/clients/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientName: values.clientName,
          companyName: values.companyName,
          contactPerson: String(form.get("contactPerson") ?? "").trim() || null,
          email: String(form.get("email") ?? "").trim() || null,
          phone: values.phone,
          billingAddress: values.billingAddress,
          city: values.city,
          country: String(form.get("country") ?? "").trim() || null,
          postalCode: String(form.get("postalCode") ?? "").trim() || null,
          billingType: String(form.get("billingType") ?? ""),
          notes: String(form.get("notes") ?? "").trim() || null,
        }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Unable to update client details.");
      setMessage("Client details updated.");
      setEditingClientDetails(false);
      await load();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Unable to update client details.");
    } finally {
      setClientDetailsSaving(false);
    }
  };

  const addLateFee = async (invoiceId: string) => {
    const amountRaw = window.prompt("Late fee amount (LKR)");
    if (amountRaw == null) return;
    const amount = Number(amountRaw);
    if (!Number.isFinite(amount) || amount <= 0) {
      setMessage("");
      setActionError("Enter a late fee amount greater than zero.");
      return;
    }
    const description = window.prompt("Late fee description", "Late fee") ?? "Late fee";
    setLateFeeInvoiceId(invoiceId);
    setActionError("");
    setMessage("");
    try {
      const response = await fetch(`/api/invoices/${invoiceId}/late-fee`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount, description }),
      });
      const result = await response.json() as { invoice?: { invoiceNumber: string | null }; error?: string };
      if (!response.ok) throw new Error(result.error ?? "Unable to add late fee.");
      setMessage(`Late fee added to draft ${result.invoice?.invoiceNumber ?? "invoice"}. Review before sending.`);
      await load();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Unable to add late fee.");
    } finally {
      setLateFeeInvoiceId(null);
    }
  };

  return (
    <div className="flex flex-col gap-5" style={{ padding: 24 }}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <Link href="/invoices?tab=clients" style={{ color: "#0E7A70", fontSize: 12, fontWeight: 600, textDecoration: "none" }}>← Client folders</Link>
          <h2 style={{ fontSize: 20, fontWeight: 700, marginTop: 8 }}>{data.client.company}</h2>
          <p style={{ color: "#6B7280", fontSize: 13 }}>{data.client.contact ?? "Client invoice history"}</p>
        </div>
        <Link
          href={`/invoices/new?clientId=${id}`}
          className="rounded-lg px-4 font-semibold"
          style={{ height: 36, display: "inline-flex", alignItems: "center", fontSize: 13, background: "#2FBEB3", color: "#FFFFFF", textDecoration: "none" }}
        >
          New invoice
        </Link>
      </div>

      <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }}>
        {[
          ["Total billed", data.summary.totalBilled, "#111111"],
          ["Total paid", data.summary.totalPaid, "#15803D"],
          ["Outstanding", data.summary.totalOutstanding, "#B91C1C"],
          ["Late days", String(data.summary.totalLateDays), "#111111"],
        ].map(([label, value, color]) => (
          <div key={label} className="rounded-xl px-4 py-3" style={{ background: "#FFFFFF", border: "1px solid #E3E7EF" }}>
            <div style={{ fontSize: 11, color: "#6B7280", textTransform: "uppercase" }}>{label}</div>
            <div style={{ fontSize: 20, fontWeight: 700, marginTop: 6, color }}>
              {label === "Late days" ? value : formatMoney(value)}
            </div>
          </div>
        ))}
      </div>

      {editingClientDetails ? (
        <form
          key={data.client.updatedAt ?? data.client.id}
          onSubmit={(event) => void saveClientDetails(event)}
          className="rounded-xl p-4 grid gap-3"
          style={{ background: "#FFFFFF", border: "1px solid #E3E7EF", gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}
        >
          <strong style={{ gridColumn: "1 / -1", fontSize: 14 }}>Service request form</strong>
          {([
            ["clientName", "Client name", data.client.clientName ?? ""],
            ["companyName", "Company name", data.client.companyName ?? data.client.company],
            ["contactPerson", "Contact person", data.client.contactPerson ?? data.client.contact ?? ""],
            ["email", "Email", data.client.email ?? ""],
            ["phone", "Phone", data.client.phone ?? ""],
            ["billingAddress", "Billing address", data.client.billingAddress ?? ""],
            ["city", "City", data.client.city ?? ""],
            ["country", "Country", data.client.country ?? ""],
            ["postalCode", "Postal code", data.client.postalCode ?? ""],
          ] as const).map(([name, label, value]) => (
            <label key={name} style={{ fontSize: 12, color: "#6B7280" }}>
              {label}{isRequiredClientField(name) && <span style={{ color: "#DC2626" }}> *</span>}
              <input
                name={name}
                defaultValue={value}
                aria-invalid={Boolean(clientDetailErrors[name])}
                style={{ display: "block", width: "100%", height: 36, marginTop: 5, border: `1px solid ${clientDetailErrors[name] ? "#DC2626" : "#E3E7EF"}`, borderRadius: 8, padding: "0 10px" }}
              />
              {clientDetailErrors[name] && <span style={{ display: "block", marginTop: 4, color: "#DC2626" }}>{clientDetailErrors[name]}</span>}
            </label>
          ))}
          <label style={{ fontSize: 12, color: "#6B7280" }}>
            Billing type
            <select
              name="billingType"
              defaultValue={data.client.billingType ?? "one_time_development"}
              style={{ display: "block", width: "100%", height: 36, marginTop: 5, border: "1px solid #E3E7EF", borderRadius: 8, padding: "0 10px" }}
            >
              <option value="one_time_development">One-time Development</option>
              <option value="monthly_retainer">Monthly Retainer</option>
              <option value="both">Both</option>
            </select>
          </label>
          <label style={{ fontSize: 12, color: "#6B7280", gridColumn: "1 / -1" }}>
            Notes
            <textarea
              name="notes"
              defaultValue={data.client.notes ?? ""}
              rows={3}
              style={{ display: "block", width: "100%", marginTop: 5, border: "1px solid #E3E7EF", borderRadius: 8, padding: 10 }}
            />
          </label>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={clientDetailsSaving}
              className="rounded-lg px-4 font-semibold"
              style={{ height: 36, background: "#0E7A70", color: "#FFFFFF", border: "none" }}
            >
              {clientDetailsSaving ? "Saving…" : "Save details"}
            </button>
            <button
              type="button"
              disabled={clientDetailsSaving}
              onClick={() => setEditingClientDetails(false)}
              className="rounded-lg px-4 font-semibold"
              style={{ height: 36, background: "#FFFFFF", color: "#374151", border: "1px solid #E3E7EF" }}
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <div
          className="rounded-xl px-4 py-3 flex items-center justify-between"
          style={{ background: "#FFFFFF", border: "1px solid #E3E7EF" }}
        >
          <strong style={{ fontSize: 14 }}>Client form</strong>
          <button
            type="button"
            aria-label="Edit service request form"
            title="Edit service request form"
            onClick={() => setEditingClientDetails(true)}
            className="rounded-lg flex items-center justify-center"
            style={{ width: 32, height: 32, background: "#E3F7F5", color: "#0E7A70", border: "none", fontSize: 18 }}
          >
            ✎
          </button>
        </div>
      )}

      <div className="rounded-xl p-4 flex items-center gap-4 flex-wrap" style={{ background: "#FFFFFF", border: "1px solid #E3E7EF" }}>
        <strong>Client type</strong>
        <select
          value={data.client.clientType ?? "new"}
          disabled={clientTypeSaving}
          onChange={(e) => void saveClientType(e.target.value as "new" | "existing")}
          className="rounded-lg px-3"
          style={{ height: 36, border: "1px solid #E3E7EF", fontSize: 13 }}
        >
          <option value="new">New Client</option>
          <option value="existing">Existing Client</option>
        </select>
        <strong style={{ marginLeft: 12 }}>Recurring</strong>
        <label className="flex items-center gap-2" style={{ fontSize: 13 }}>
          <input
            type="checkbox"
            checked={recurring?.status === "active"}
            disabled={recurringSaving}
            onChange={(e) => void saveRecurring({ enable: e.target.checked, status: e.target.checked ? "active" : "paused" })}
          />
          Enable monthly drafts
        </label>
        <label style={{ fontSize: 13 }}>
          Billing day
          <select
            value={recurring?.billingDay ?? 1}
            disabled={recurringSaving}
            onChange={(e) => void saveRecurring({ billingDay: Number(e.target.value), status: recurring?.status ?? "active" })}
            className="rounded-lg px-2"
            style={{ width: 70, height: 32, marginLeft: 8, border: "1px solid #E3E7EF", borderRadius: 6 }}
          >
            {Array.from({ length: 31 }, (_, index) => index + 1).map((day) => (
              <option key={day} value={day}>{day}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex gap-3">
        <select value={filter} onChange={(e) => setFilter(e.target.value)} className="rounded-lg px-3" style={{ height: 36, border: "1px solid #E3E7EF" }}>
          <option value="">All invoices</option>
          <option value="paid">Paid</option>
          <option value="unpaid">Unpaid</option>
          <option value="overdue">Overdue</option>
        </select>
        <select value={year} onChange={(e) => setYear(e.target.value)} className="rounded-lg px-3" style={{ height: 36, border: "1px solid #E3E7EF" }}>
          <option value="">All years</option>
          {data.years.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
      </div>
      {actionError && <p style={{ color: "#DC2626", fontSize: 12 }}>{actionError}</p>}
      {message && <p style={{ color: "#15803D", fontSize: 12 }}>{message}</p>}
      <div className="rounded-xl overflow-hidden" style={{ background: "#FFFFFF", border: "1px solid #E3E7EF" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#F9FAFB" }}>
              {["Invoice", "Month", "Amount", "Due date", "Paid", "Status", "Days late", ""].map((item) => (
                <th key={item || "actions"} className="text-left" style={{ padding: 12, fontSize: 11, color: "#6B7280" }}>{item}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.invoices.length === 0 && (
              <tr>
                <td colSpan={8} style={{ padding: 24, textAlign: "center", color: "#6B7280", fontSize: 13 }}>No invoices for this filter.</td>
              </tr>
            )}
            {data.invoices.map((invoice) => {
              const showLateFee = invoice.displayStatus === "overdue" || (invoice.daysLate > 0 && Number(invoice.outstanding) > 0);
              return (
                <tr key={invoice.id} style={{ borderTop: "1px solid #F3F4F6" }}>
                  <td style={{ padding: 12 }}>
                    <Link href={`/invoices/${invoice.id}`} style={{ color: "#0E7A70", fontWeight: 600 }}>
                      {invoice.invoiceNumber ?? "Draft"}
                    </Link>
                  </td>
                  <td style={{ padding: 12 }}>{formatBillingMonth(invoice.billingMonth ?? invoice.invoiceDate)}</td>
                  <td style={{ padding: 12 }}>{formatMoney(invoice.total, invoice.currency)}</td>
                  <td style={{ padding: 12 }}>{invoice.dueDate}</td>
                  <td style={{ padding: 12 }}>{formatMoney(invoice.amountPaid, invoice.currency)}</td>
                  <td style={{ padding: 12 }}><StatusBadge status={invoice.tableStatus ?? invoice.displayStatus} /></td>
                  <td style={{ padding: 12, color: invoice.displayStatus === "overdue" ? "#B91C1C" : "#374151" }}>
                    {formatDaysLateLabel(invoice.daysLate, invoice.displayStatus)}
                  </td>
                  <td style={{ padding: 12 }}>
                    {showLateFee && (
                      <button
                        type="button"
                        disabled={lateFeeInvoiceId === invoice.id}
                        onClick={() => void addLateFee(invoice.id)}
                        className="rounded-lg px-2.5 font-semibold"
                        style={{
                          height: 30,
                          fontSize: 11,
                          background: "#FEF2F2",
                          color: "#B91C1C",
                          border: "1px solid #FECACA",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {lateFeeInvoiceId === invoice.id ? "Adding…" : "Add late fee to next invoice"}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
