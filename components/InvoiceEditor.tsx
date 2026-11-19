"use client";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { notifyCrmDataChanged } from "@/lib/crm-invalidation";
import { displayStatusLabel, validateDiscountPercent } from "@/lib/invoice-format";
import { readDraft, useFormDraft } from "@/lib/use-form-draft";
import {
  InvoiceDraftTemplate,
  type InvoiceDraftValues,
} from "@/components/InvoiceDraftTemplate";

type LineItem = {
  id?: string;
  description: string;
  qty: number;
  unitPrice: string;
  total?: string;
  position?: number;
};

type Invoice = {
  id: string;
  invoiceNumber: string | null;
  status: "draft" | "sent" | "issued" | "part_paid" | "paid" | "void";
  displayStatus: string;
  clientType: "new" | "existing";
  invoiceDate: string;
  dueDate: string;
  currency: string;
  subtotal: string;
  discountPercent: string;
  total: string;
  amountPaid?: string;
  outstanding?: string;
  daysLate?: number;
  billToName: string | null;
  billToCompany: string | null;
  billToLine1: string | null;
  billToLine2: string | null;
  billToCity: string | null;
  billToPostal: string | null;
  bankName: string | null;
  accountName: string | null;
  accountNumber: string | null;
  paymentAccountType: "savings" | "current" | null;
  termsAndConditions: string | null;
  invoiceClientId: string;
  leadId?: string;
  lead?: { id: string; company: string; contact: string | null };
  invoiceClient?: { id: string; companyName: string; contactPerson: string | null };
  lineItems: LineItem[];
};

type InvoiceClientOption = {
  id: string;
  company: string;
  companyName?: string;
  contact: string | null;
  contactPerson?: string | null;
  clientName?: string;
  clientType?: "new" | "existing";
  billingAddress?: string | null;
  city?: string | null;
  postalCode?: string | null;
};

type CompanySettings = {
  companyName: string;
  companyPhone?: string;
  companyEmail?: string;
  companyWebsite?: string;
  defaultBankName: string;
  defaultAccountName: string;
  defaultAccountNumber: string;
  termsAndConditions: string;
  nextInvoiceSequence?: number;
  paymentAccounts?: Array<{ accountType: "savings" | "current"; bankName: string; accountName: string; accountNumber: string; isActive: boolean }>;
};

const inputStyle: CSSProperties = {
  height: 36,
  width: "100%",
  border: "1.5px solid #E3E7EF",
  borderRadius: 8,
  padding: "0 10px",
  fontSize: 13,
  color: "#111111",
  background: "#FFFFFF",
  outline: "none",
};

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span style={{ fontSize: 12, fontWeight: 600, color: "#6B7280" }}>{label}</span>
      {children}
    </label>
  );
}

function emptyDraftValues(settings?: CompanySettings | null): InvoiceDraftValues {
  const savingsAccount = settings?.paymentAccounts?.find((account) => account.accountType === "savings" && account.isActive);

  return {
    invoiceNumber: null,
    clientType: "new",
    invoiceDate: "",
    dueDate: "",
    currency: "LKR",
    billToName: "",
    billToCompany: "",
    billToLine1: "",
    billToLine2: "",
    billToCity: "",
    billToPostal: "",
    bankName: savingsAccount?.bankName ?? settings?.defaultBankName ?? "",
    accountName: savingsAccount?.accountName ?? settings?.defaultAccountName ?? "",
    accountNumber: savingsAccount?.accountNumber ?? settings?.defaultAccountNumber ?? "",
    paymentAccountType: savingsAccount ? "savings" : null,
    paymentAccounts: settings?.paymentAccounts?.filter((account) => account.isActive) ?? [],
    discountPercent: "0",
    lineItems: [{ description: "", qty: 1, unitPrice: "" }],
    termsAndConditions: settings?.termsAndConditions ?? null,
    companyName: settings?.companyName ?? "DocLink",
    companyPhone: settings?.companyPhone ?? "+94 76 567 2814",
    companyEmail: settings?.companyEmail ?? "info@doclinkcare.com",
    companyWebsite: settings?.companyWebsite ?? "doclinkcare.com",
  };
}

export function InvoiceCreate({ initialLeadId, initialClientId }: { initialLeadId?: string; initialClientId?: string }) {
  const router = useRouter();
  const initialId = initialClientId ?? initialLeadId ?? "";
  const draftKey = `invoice:new:${initialId || "blank"}`;
  const [restoredDraft] = useState(() => readDraft<{ clientId: string; values: InvoiceDraftValues }>(draftKey));
  const [clients, setClients] = useState<InvoiceClientOption[]>([]);
  const [clientId, setClientId] = useState(restoredDraft?.clientId ?? initialId);
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [values, setValues] = useState<InvoiceDraftValues>(() => restoredDraft?.values ?? emptyDraftValues());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const clearCreateDraft = useFormDraft(draftKey, { clientId, values }, {
    isEmpty: (draft) => !draft.clientId && draft.values.lineItems.every((item) => !item.description.trim() && !item.unitPrice.trim()),
  });

  const patchValues = (patch: Partial<InvoiceDraftValues>) => {
    setValues((prev) => ({ ...prev, ...patch }));
  };

  const prefillFromClient = (client: InvoiceClientOption, companySettings: CompanySettings | null) => {
    const savingsAccount = companySettings?.paymentAccounts?.find((account) => account.accountType === "savings" && account.isActive);

    setClientId(client.id);
    setValues((prev) => ({
      ...prev,
      clientType: client.clientType ?? "new",
      billToName: client.contactPerson || client.contact || client.clientName || "",
      billToCompany: client.companyName || client.company,
      billToLine1: client.billingAddress ?? "",
      billToCity: client.city ?? "",
      billToPostal: client.postalCode ?? "",
      bankName: savingsAccount?.bankName || companySettings?.defaultBankName || prev.bankName,
      accountName: savingsAccount?.accountName || companySettings?.defaultAccountName || prev.accountName,
      accountNumber: savingsAccount?.accountNumber || companySettings?.defaultAccountNumber || prev.accountNumber,
      paymentAccountType: savingsAccount ? "savings" : null,
      paymentAccounts: companySettings?.paymentAccounts?.filter((account) => account.isActive) ?? prev.paymentAccounts,
      termsAndConditions: companySettings?.termsAndConditions ?? prev.termsAndConditions,
      companyName: companySettings?.companyName ?? prev.companyName,
      companyPhone: companySettings?.companyPhone ?? prev.companyPhone,
      companyEmail: companySettings?.companyEmail ?? prev.companyEmail,
      companyWebsite: companySettings?.companyWebsite ?? prev.companyWebsite,
    }));
  };

  useEffect(() => {
    void (async () => {
      try {
        const [clientsRes, settingsRes] = await Promise.all([
          fetch("/api/invoices/clients"),
          fetch("/api/invoice-settings"),
        ]);
        const clientsResult = await clientsRes.json() as {
          clients?: InvoiceClientOption[];
          error?: string;
        };
        if (!clientsRes.ok) throw new Error(clientsResult.error ?? "Unable to load invoice clients.");
        const list = clientsResult.clients ?? [];
        setClients(list);

        let companySettings: CompanySettings | null = null;
        if (settingsRes.ok) {
          const settingsResult = await settingsRes.json() as { settings?: CompanySettings };
          companySettings = settingsResult.settings ?? null;
          setSettings(companySettings);
        }

        if (restoredDraft) {
          setSettings(companySettings);
        } else if (initialId) {
          const selected = list.find((client) => client.id === initialId);
          if (selected) prefillFromClient(selected, companySettings);
          else setValues(emptyDraftValues(companySettings));
        } else {
          setValues(emptyDraftValues(companySettings));
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to load clients.");
      } finally {
        setLoading(false);
      }
    })();
  }, [initialId]);

  const create = async () => {
    setSaving(true);
    setError("");
    try {
      const discountError = validateDiscountPercent(Number(values.discountPercent));
      if (discountError) throw new Error(discountError);
      if (values.lineItems.every((item) => !item.description.trim())) {
        throw new Error("Add at least one line item");
      }
      const response = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoiceClientId: clientId,
          clientType: values.clientType,
          invoiceDate: values.invoiceDate || undefined,
          dueDate: values.dueDate || undefined,
          currency: values.currency,
          discountPercent: values.discountPercent,
          billToName: values.billToName,
          billToCompany: values.billToCompany,
          billToLine1: values.billToLine1,
          billToLine2: values.billToLine2,
          billToCity: values.billToCity,
          billToPostal: values.billToPostal,
          bankName: values.bankName,
          accountName: values.accountName,
          accountNumber: values.accountNumber,
          paymentAccountType: values.paymentAccountType,
          lineItems: values.lineItems,
        }),
      });
      const result = await response.json() as { invoice?: Invoice; error?: string };
      if (!response.ok || !result.invoice) throw new Error(result.error ?? "Unable to create invoice.");
      notifyCrmDataChanged("invoices", "notifications");
      clearCreateDraft();
      router.push(`/invoices/${result.invoice.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create invoice.");
      setSaving(false);
    }
  };

  const cancelCreate = () => {
    if (!window.confirm("Cancel this invoice? All entered data will be cleared.")) return;
    setClientId("");
    setValues(emptyDraftValues(settings));
    clearCreateDraft();
    router.push("/invoices");
  };

  return (
    <div className="flex flex-col gap-5" style={{ padding: 24, maxWidth: 960 }}>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <Link href="/invoices" style={{ fontSize: 12, color: "#0E7A70", textDecoration: "none", fontWeight: 600 }}>← Invoices</Link>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "#111111", marginTop: 8 }}>New Invoice</h2>
        </div>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={cancelCreate}
            className="rounded-lg px-4 font-semibold"
            style={{ height: 36, fontSize: 13, color: "#6B7280", border: "1px solid #E5E7EB", background: "#FFFFFF", cursor: "pointer" }}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!clientId || saving || loading}
            onClick={() => void create()}
            className="rounded-lg px-4 font-semibold"
            style={{ height: 36, fontSize: 13, background: "#2FBEB3", color: "#FFFFFF", border: "none", opacity: !clientId || saving || loading ? 0.6 : 1, cursor: "pointer" }}
          >
            {saving ? "Processing" : "Create draft"}
          </button>
        </div>
      </div>

      {error && <p role="alert" style={{ fontSize: 12, color: "#DC2626", margin: 0 }}>{error}</p>}

      {loading ? (
        <p style={{ fontSize: 13, color: "#6B7280" }}>Loading invoice clients…</p>
      ) : (
        <>
          <InvoiceDraftTemplate
            values={values}
            onChange={patchValues}
            clientPicker={(
              <Field label="Invoice Client">
                <select
                  style={inputStyle}
                  value={clientId}
                  onChange={(e) => {
                    const next = clients.find((client) => client.id === e.target.value);
                    if (next) prefillFromClient(next, settings);
                    else setClientId(e.target.value);
                  }}
                >
                  <option value="">Select client…</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.companyName || client.company} ({client.clientType ?? "new"})
                    </option>
                  ))}
                </select>
              </Field>
            )}
          />
        </>
      )}
    </div>
  );
}

export function InvoiceDetail({ invoiceId }: { invoiceId: string }) {
  const draftKey = `invoice:${invoiceId}`;
  const [restoredDraft] = useState(() => readDraft<InvoiceDraftValues>(draftKey));
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [values, setValues] = useState<InvoiceDraftValues>(() => emptyDraftValues());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [clickedAction, setClickedAction] = useState<"paid" | "record" | null>(null);
  const [processingAction, setProcessingAction] = useState<"save" | "issue" | "record" | "paid" | "void" | "preview" | null>(null);
  const clearInvoiceDraft = useFormDraft(invoice?.status === "draft" ? draftKey : null, values, {
    isEmpty: () => false,
  });

  const patchValues = (patch: Partial<InvoiceDraftValues>) => {
    setValues((prev) => ({ ...prev, ...patch }));
  };

  const applyInvoice = (
    data: Invoice,
    company: {
      companyName?: string;
      companyPhone?: string;
      companyEmail?: string;
      companyWebsite?: string;
      paymentAccounts?: CompanySettings["paymentAccounts"];
    } = {},
    restoreDraft = true,
  ) => {
    setInvoice(data);
    const serverValues: InvoiceDraftValues = {
      invoiceNumber: data.invoiceNumber,
      clientType: data.clientType,
      invoiceDate: data.invoiceDate,
      dueDate: data.dueDate,
      currency: data.currency,
      billToName: data.billToName ?? "",
      billToCompany: data.billToCompany ?? "",
      billToLine1: data.billToLine1 ?? "",
      billToLine2: data.billToLine2 ?? "",
      billToCity: data.billToCity ?? "",
      billToPostal: data.billToPostal ?? "",
      bankName: data.bankName ?? "",
      accountName: data.accountName ?? "",
      accountNumber: data.accountNumber ?? "",
      paymentAccountType: data.paymentAccountType,
      paymentAccounts: [],
      discountPercent: data.discountPercent,
      lineItems: data.lineItems.map((item) => ({
        id: item.id,
        description: item.description,
        qty: item.qty,
        unitPrice: String(item.unitPrice),
      })),
      termsAndConditions: data.termsAndConditions,
      companyName: company.companyName ?? "DocLink",
      companyPhone: company.companyPhone ?? "+94 76 567 2814",
      companyEmail: company.companyEmail ?? "info@doclinkcare.com",
      companyWebsite: company.companyWebsite ?? "doclinkcare.com",
    };
    setValues(data.status === "draft" && restoreDraft && restoredDraft ? restoredDraft : serverValues);
  };

  const load = async () => {
    setLoading(true);
    try {
      const [invoiceRes, settingsRes] = await Promise.all([
        fetch(`/api/invoices/${invoiceId}`),
        fetch("/api/invoice-settings"),
      ]);
      const result = await invoiceRes.json() as { invoice?: Invoice; error?: string };
      if (!invoiceRes.ok || !result.invoice) throw new Error(result.error ?? "Unable to load invoice.");
      let company: {
        companyName?: string;
        companyPhone?: string;
        companyEmail?: string;
        companyWebsite?: string;
        paymentAccounts?: CompanySettings["paymentAccounts"];
      } = {};
      if (settingsRes.ok) {
        const settingsResult = await settingsRes.json() as { settings?: CompanySettings };
        company = {
          companyName: settingsResult.settings?.companyName ?? "DocLink",
          companyPhone: settingsResult.settings?.companyPhone,
          companyEmail: settingsResult.settings?.companyEmail,
          companyWebsite: settingsResult.settings?.companyWebsite,
          paymentAccounts: settingsResult.settings?.paymentAccounts,
        };
      }
      applyInvoice(result.invoice, company);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load invoice.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [invoiceId]);

  const readOnly = invoice?.status !== "draft";

  const draftPayload = () => ({
    clientType: values.clientType,
    invoiceDate: values.invoiceDate,
    dueDate: values.dueDate,
    currency: values.currency,
    discountPercent: values.discountPercent,
    billToName: values.billToName,
    billToCompany: values.billToCompany,
    billToLine1: values.billToLine1,
    billToLine2: values.billToLine2,
    billToCity: values.billToCity,
    billToPostal: values.billToPostal,
    bankName: values.bankName,
    accountName: values.accountName,
    accountNumber: values.accountNumber,
    paymentAccountType: values.paymentAccountType,
    lineItems: values.lineItems,
  });

  const saveDraft = async () => {
    setProcessingAction("save");
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const discountError = validateDiscountPercent(Number(values.discountPercent));
      if (discountError) throw new Error(discountError);
      const response = await fetch(`/api/invoices/${invoiceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draftPayload()),
      });
      const result = await response.json() as { invoice?: Invoice; error?: string };
      if (!response.ok || !result.invoice) throw new Error(result.error ?? "Unable to save invoice.");
      applyInvoice(result.invoice, { companyName: values.companyName }, false);
      setMessage("Draft saved.");
      clearInvoiceDraft();
      notifyCrmDataChanged("invoices", "notifications");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save invoice.");
    } finally {
      setSaving(false);
      setProcessingAction(null);
    }
  };

  const issue = async () => {
    setProcessingAction("issue");
    setSaving(true);
    setError("");
    try {
      const discountError = validateDiscountPercent(Number(values.discountPercent));
      if (discountError) throw new Error(discountError);
      if (invoice?.status === "draft") {
        const saveRes = await fetch(`/api/invoices/${invoiceId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(draftPayload()),
        });
        if (!saveRes.ok) {
          const result = await saveRes.json() as { error?: string };
          throw new Error(result.error ?? "Unable to save before issuing.");
        }
      }
      const response = await fetch(`/api/invoices/${invoiceId}/issue`, { method: "POST" });
      const result = await response.json() as { invoice?: Invoice; error?: string };
      if (!response.ok || !result.invoice) throw new Error(result.error ?? "Unable to issue invoice.");
      applyInvoice(result.invoice, { companyName: values.companyName }, false);
      setMessage(`Issued as ${result.invoice.invoiceNumber}.`);
      clearInvoiceDraft();
      notifyCrmDataChanged("invoices", "notifications");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to issue invoice.");
    } finally {
      setSaving(false);
      setProcessingAction(null);
    }
  };

  const setStatus = async (status: "paid" | "void") => {
    if (status === "paid") {
      setClickedAction("paid");
      setProcessingAction("paid");
    } else {
      setProcessingAction("void");
    }
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/invoices/${invoiceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const result = await response.json() as { invoice?: Invoice; error?: string };
      if (!response.ok || !result.invoice) throw new Error(result.error ?? "Unable to update status.");
      applyInvoice(result.invoice, { companyName: values.companyName });
      setMessage(status === "paid" ? "Marked as paid." : "Invoice voided.");
      notifyCrmDataChanged("invoices", "notifications");
      if (status === "paid") window.setTimeout(() => setClickedAction(null), 1800);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update status.");
      setClickedAction(null);
    } finally {
      setSaving(false);
      setProcessingAction(null);
    }
  };

  const recordPayment = async () => {
    const amountRaw = window.prompt("Payment amount (LKR)");
    if (amountRaw == null) {
      return;
    }
    const amount = Number(amountRaw);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Enter a payment amount greater than zero.");
      return;
    }
    const paymentDate = window.prompt("Payment date (YYYY-MM-DD)", new Date().toISOString().slice(0, 10));
    if (!paymentDate) {
      return;
    }
    setClickedAction("record");
    setProcessingAction("record");
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(`/api/invoices/${invoiceId}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount, paymentDate }),
      });
      const result = await response.json() as { invoice?: Invoice & { daysLate?: number }; error?: string };
      if (!response.ok || !result.invoice) throw new Error(result.error ?? "Unable to record payment.");
      applyInvoice(result.invoice, { companyName: values.companyName });
      const daysLate = result.invoice.daysLate ?? 0;
      setMessage(daysLate > 0
        ? `Payment recorded · ${daysLate} day${daysLate === 1 ? "" : "s"} late.`
        : "Payment recorded on or before the due date.");
      notifyCrmDataChanged("invoices", "notifications");
      await load();
      window.setTimeout(() => setClickedAction(null), 1800);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to record payment.");
      setClickedAction(null);
    } finally {
      setSaving(false);
      setProcessingAction(null);
    }
  };

  if (loading || !invoice) {
    return (
      <div style={{ padding: 24 }}>
        <p style={{ fontSize: 13, color: error ? "#DC2626" : "#6B7280" }}>{error || "Loading invoice…"}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5" style={{ padding: 24, maxWidth: 960 }}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <Link href="/invoices" style={{ fontSize: 12, color: "#0E7A70", textDecoration: "none", fontWeight: 600 }}>← Invoices</Link>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "#111111", marginTop: 8 }}>
            {invoice.invoiceNumber ?? "Draft invoice"}
          </h2>
          <p style={{ fontSize: 13, color: "#6B7280", marginTop: 4 }}>
            {invoice.lead?.company ?? values.billToCompany} · {invoice.clientType} client · {displayStatusLabel(invoice.displayStatus)}
            {invoice.displayStatus === "overdue" ? ` · ${invoice.daysLate ?? 0} days overdue` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {invoice.status !== "void" && (
            <a
              href={`/api/invoices/${invoice.id}/pdf`}
              target="_blank"
              rel="noreferrer"
              onClick={() => {
                setProcessingAction("preview");
                window.setTimeout(() => setProcessingAction(null), 900);
              }}
              className="rounded-lg px-3 font-semibold"
              style={{ height: 36, display: "inline-flex", alignItems: "center", fontSize: 12, background: "#E3F7F5", color: "#0E7A70", textDecoration: "none", border: "1px solid #A7F3D0", cursor: "pointer" }}
            >
              {invoice.status === "draft"
                ? processingAction === "preview" ? "Processing" : "Preview PDF"
                : "Download PDF"}
            </a>
          )}
          {invoice.status === "draft" && (
            <>
              <button type="button" disabled={saving} onClick={() => void saveDraft()} className="rounded-lg px-3 font-semibold" style={{ height: 36, fontSize: 12, background: "#F3F4F6", color: "#374151", border: "none", cursor: "pointer" }}>
                {processingAction === "save" ? "Processing" : "Save draft"}
              </button>
              <button type="button" disabled={saving} onClick={() => void issue()} className="rounded-lg px-3 font-semibold" style={{ height: 36, fontSize: 12, background: "#2FBEB3", color: "#FFFFFF", border: "none", cursor: "pointer" }}>
                {processingAction === "issue" ? "Processing" : "Issue invoice"}
              </button>
            </>
          )}
          {((invoice.status === "sent" || invoice.status === "issued") || invoice.status === "part_paid") && (
            <>
              <button type="button" disabled={saving} onClick={() => void recordPayment()} className="rounded-lg px-3 font-semibold" style={{ height: 36, fontSize: 12, background: clickedAction === "record" ? "#075E54" : "#0E7A70", color: "#FFFFFF", border: "none", boxShadow: clickedAction === "record" ? "0 0 0 3px #A7F3D0" : "none", transform: clickedAction === "record" ? "scale(0.98)" : "none", cursor: "pointer" }}>
                {processingAction === "record"
                  ? "Processing"
                  : clickedAction === "record"
                    ? "✓ Payment recorded"
                  : invoice.status === "part_paid"
                    ? "Record partial payment"
                    : "Record payment"}
              </button>
              <button type="button" disabled={saving} onClick={() => void setStatus("paid")} className="rounded-lg px-3 font-semibold" style={{ height: 36, fontSize: 12, background: clickedAction === "paid" ? "#166534" : "#16A34A", color: "#FFFFFF", border: "none", boxShadow: clickedAction === "paid" ? "0 0 0 3px #BBF7D0" : "none", transform: clickedAction === "paid" ? "scale(0.98)" : "none", cursor: "pointer" }}>
                {processingAction === "paid" ? "Processing" : clickedAction === "paid" ? "✓ Marked paid" : "Mark paid"}
              </button>
            </>
          )}
          {(invoice.status === "draft" || invoice.status === "sent" || invoice.status === "issued" || invoice.status === "part_paid") && (
            <button type="button" disabled={saving} onClick={() => void setStatus("void")} className="rounded-lg px-3 font-semibold" style={{ height: 36, fontSize: 12, background: "#FEE2E2", color: "#B91C1C", border: "none", cursor: "pointer" }}>
              {processingAction === "void" ? "Processing" : "Void"}
            </button>
          )}
        </div>
      </div>

      {error && <p role="alert" style={{ fontSize: 12, color: "#DC2626", margin: 0 }}>{error}</p>}

      <InvoiceDraftTemplate
        values={values}
        onChange={patchValues}
        readOnly={readOnly}
      />

      {message && <p style={{ fontSize: 12, color: "#16A34A" }}>{message}</p>}
    </div>
  );
}
