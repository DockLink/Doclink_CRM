"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { formatMoney } from "@/lib/invoice-format";

export type ClientFolderSummary = {
  id: string;
  company: string;
  contact: string | null;
  invoiceCount: number;
  totalBilled: string;
  totalPaid: string;
  totalOutstanding: string;
};

export function ClientInvoiceFolders() {
  const [clients, setClients] = useState<ClientFolderSummary[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    clientName: "",
    companyName: "",
    contactPerson: "",
    email: "",
    phone: "",
    billingAddress: "",
    city: "",
    country: "",
    postalCode: "",
    clientType: "new" as "new" | "existing",
    billingType: "one_time_development" as "one_time_development" | "monthly_retainer" | "both",
    notes: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/invoices/clients");
      const result = await response.json() as { clients?: ClientFolderSummary[]; error?: string };
      if (!response.ok) throw new Error(result.error ?? "Unable to load client folders.");
      setClients(result.clients ?? []);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load client folders.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return clients;
    return clients.filter((client) =>
      client.company.toLowerCase().includes(needle)
      || (client.contact ?? "").toLowerCase().includes(needle),
    );
  }, [clients, query]);

  const createClient = async () => {
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/invoices/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Unable to create client.");
      setShowForm(false);
      setForm({
        clientName: "",
        companyName: "",
        contactPerson: "",
        email: "",
        phone: "",
        billingAddress: "",
        city: "",
        country: "",
        postalCode: "",
        clientType: "new",
        billingType: "one_time_development",
        notes: "",
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create client.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h3 style={{ fontSize: 18, fontWeight: 700, color: "#111111" }}>Invoice Clients</h3>
          <p style={{ fontSize: 13, color: "#6B7280", marginTop: 4 }}>
            Independent billing clients (not CRM leads). Open a folder for invoices and payments.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm((value) => !value)}
          className="rounded-lg px-4 font-semibold"
          style={{ height: 36, background: "#2FBEB3", color: "#FFFFFF", border: "none", fontSize: 13 }}
        >
          {showForm ? "Close form" : "Add client"}
        </button>
      </div>

      {showForm && (
        <div className="rounded-xl p-4 grid gap-3" style={{ background: "#FFFFFF", border: "1px solid #E3E7EF", gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
          {([
            ["clientName", "Client name"],
            ["companyName", "Company name"],
            ["contactPerson", "Contact person"],
            ["email", "Email"],
            ["phone", "Phone"],
            ["billingAddress", "Billing address"],
            ["city", "City"],
            ["country", "Country"],
            ["postalCode", "Postal code"],
          ] as const).map(([field, label]) => (
            <label key={field} style={{ fontSize: 12, color: "#6B7280" }}>
              {label}
              <input
                value={form[field]}
                onChange={(e) => setForm((current) => ({ ...current, [field]: e.target.value }))}
                style={{ display: "block", width: "100%", height: 36, marginTop: 5, border: "1px solid #E3E7EF", borderRadius: 8, padding: "0 10px" }}
              />
            </label>
          ))}
          <label style={{ fontSize: 12, color: "#6B7280" }}>
            Client type
            <select
              value={form.clientType}
              onChange={(e) => setForm((current) => ({ ...current, clientType: e.target.value as "new" | "existing" }))}
              style={{ display: "block", width: "100%", height: 36, marginTop: 5, border: "1px solid #E3E7EF", borderRadius: 8, padding: "0 10px" }}
            >
              <option value="new">New Client</option>
              <option value="existing">Existing Client</option>
            </select>
          </label>
          <label style={{ fontSize: 12, color: "#6B7280" }}>
            Billing type
            <select
              value={form.billingType}
              onChange={(e) => setForm((current) => ({
                ...current,
                billingType: e.target.value as "one_time_development" | "monthly_retainer" | "both",
              }))}
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
              value={form.notes}
              onChange={(e) => setForm((current) => ({ ...current, notes: e.target.value }))}
              rows={3}
              style={{ display: "block", width: "100%", marginTop: 5, border: "1px solid #E3E7EF", borderRadius: 8, padding: 10 }}
            />
          </label>
          <button
            type="button"
            disabled={saving}
            onClick={() => void createClient()}
            className="rounded-lg px-4 font-semibold"
            style={{ height: 36, background: "#0E7A70", color: "#FFFFFF", border: "none", width: "fit-content" }}
          >
            {saving ? "Saving…" : "Save client"}
          </button>
        </div>
      )}

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search clients"
        className="rounded-lg px-3"
        style={{ height: 36, width: 280, border: "1.5px solid #E3E7EF", fontSize: 13, outline: "none" }}
      />

      {loading && <p style={{ fontSize: 13, color: "#6B7280" }}>Loading client folders…</p>}
      {error && <p style={{ fontSize: 13, color: "#DC2626" }}>{error}</p>}
      {!loading && !error && filtered.length === 0 && (
        <p style={{ fontSize: 13, color: "#6B7280" }}>No client folders yet.</p>
      )}

      <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
        {filtered.map((client) => (
          <Link
            key={client.id}
            href={`/invoices/clients/${client.id}`}
            className="rounded-xl flex flex-col"
            style={{
              background: "#FFFFFF",
              border: "1px solid #E3E7EF",
              textDecoration: "none",
              color: "inherit",
              overflow: "hidden",
            }}
          >
            <div className="px-4 pt-4 pb-3 flex items-start gap-3">
              <div
                className="rounded-lg flex items-center justify-center shrink-0"
                style={{ width: 36, height: 36, background: "#E3F7F5", color: "#0E7A70", fontWeight: 700 }}
              >
                {client.company.slice(0, 1).toUpperCase()}
              </div>
              <div className="min-w-0">
                <div style={{ fontSize: 15, fontWeight: 700, color: "#111111" }}>{client.company}</div>
                <div style={{ fontSize: 12, color: "#6B7280", marginTop: 2 }}>{client.contact ?? "—"}</div>
                <div style={{ fontSize: 12, color: "#0E7A70", fontWeight: 600, marginTop: 6 }}>
                  {client.invoiceCount} Invoice{client.invoiceCount === 1 ? "" : "s"}
                </div>
              </div>
            </div>
            <div
              className="grid gap-2 px-4 py-3"
              style={{ gridTemplateColumns: "1fr 1fr 1fr", borderTop: "1px solid #F3F4F6", background: "#F9FAFB" }}
            >
              <div>
                <div style={{ fontSize: 10, color: "#6B7280", fontWeight: 700, letterSpacing: "0.04em" }}>TOTAL BILLED</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#111111", marginTop: 4 }}>{formatMoney(client.totalBilled)}</div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: "#6B7280", fontWeight: 700, letterSpacing: "0.04em" }}>PAID</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#15803D", marginTop: 4 }}>{formatMoney(client.totalPaid)}</div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: "#6B7280", fontWeight: 700, letterSpacing: "0.04em" }}>OUTSTANDING</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#B91C1C", marginTop: 4 }}>{formatMoney(client.totalOutstanding)}</div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
