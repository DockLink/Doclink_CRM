"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { readDraft, useFormDraft } from "@/lib/use-form-draft";

type Account = {
  accountType: "savings" | "current";
  bankName: string;
  branch: string;
  accountName: string;
  accountNumber: string;
  isActive: boolean;
};
type Settings = { paymentAccounts?: Array<Partial<Account> & { accountType: "savings" | "current" }> };

const emptyAccounts = (): Account[] => [
  { accountType: "savings", bankName: "", branch: "", accountName: "", accountNumber: "", isActive: true },
  { accountType: "current", bankName: "", branch: "", accountName: "", accountNumber: "", isActive: true },
];

export function InvoiceSettingsPanel({ embedded = false }: { embedded?: boolean }) {
  const draftKey = "invoice-settings:payment-accounts";
  const [accounts, setAccounts] = useState<Account[]>(() => readDraft<Account[]>(draftKey) ?? emptyAccounts());
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const clearAccountsDraft = useFormDraft(draftKey, accounts, {
    isEmpty: (value) => value.every((account) => !account.bankName && !account.branch && !account.accountName && !account.accountNumber),
  });

  useEffect(() => {
    void fetch("/api/invoice-settings").then(async (response) => {
      const result = await response.json() as { settings?: Settings };
      if (response.ok && result.settings?.paymentAccounts && !readDraft<Account[]>(draftKey)) {
        setAccounts((current) => current.map((account) => {
          const found = result.settings?.paymentAccounts?.find((item) => item.accountType === account.accountType);
          if (!found) return account;
          return {
            accountType: account.accountType,
            bankName: found.bankName ?? "",
            branch: found.branch ?? "",
            accountName: found.accountName ?? "",
            accountNumber: found.accountNumber ?? "",
            isActive: found.isActive !== false,
          };
        }));
      }
    });
  }, []);

  const update = (type: Account["accountType"], patch: Partial<Account>) => {
    setAccounts((current) => current.map((account) => account.accountType === type ? { ...account, ...patch } : account));
  };

  const save = async () => {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/invoice-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentAccounts: accounts }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) {
        setError(result.error ?? "Unable to save invoice payment accounts.");
        return;
      }
      clearAccountsDraft();
      setMessage("Payment accounts saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save invoice payment accounts.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-5" style={{ padding: embedded ? 0 : 24, maxWidth: 820 }}>
      {!embedded && (
        <Link href="/invoices" style={{ color: "#0E7A70", fontSize: 12, fontWeight: 600, textDecoration: "none" }}>← Invoices</Link>
      )}
      <div>
        <h2 style={{ fontSize: embedded ? 16 : 20, fontWeight: 700 }}>{embedded ? "Company payment accounts" : "Invoice settings"}</h2>
        <p style={{ color: "#6B7280", fontSize: 13, marginTop: 4 }}>
          Configure savings and current accounts. Both appear on invoices by default unless changed per invoice.
        </p>
      </div>
      <div className="grid gap-4" style={{ gridTemplateColumns: "1fr 1fr" }}>
        {accounts.map((account) => (
          <div key={account.accountType} className="rounded-xl p-4 flex flex-col gap-3" style={{ background: "#FFFFFF", border: "1px solid #E3E7EF" }}>
            <h3 style={{ fontWeight: 700, textTransform: "capitalize" }}>{account.accountType} account</h3>
            {([
              ["bankName", "Bank name"],
              ["branch", "Branch"],
              ["accountName", "Account name"],
              ["accountNumber", "Account number"],
            ] as const).map(([field, label]) => (
              <label key={field} style={{ fontSize: 12, color: "#6B7280" }}>
                {label}
                <input
                  value={account[field]}
                  onChange={(e) => update(account.accountType, { [field]: e.target.value })}
                  style={{ display: "block", width: "100%", height: 36, marginTop: 5, border: "1px solid #E3E7EF", borderRadius: 8, padding: "0 10px" }}
                />
              </label>
            ))}
          </div>
        ))}
      </div>
      <button type="button" disabled={saving} onClick={() => void save()} className="rounded-lg px-4 font-semibold" style={{ alignSelf: "flex-start", height: 36, background: "#2FBEB3", color: "#FFFFFF", border: "none", cursor: "pointer", opacity: saving ? 0.7 : 1 }}>{saving ? "Processing" : "Save accounts"}</button>
      {error && <p style={{ color: "#DC2626", fontSize: 12 }}>{error}</p>}
      {message && <p style={{ color: "#15803D", fontSize: 12 }}>{message}</p>}
    </div>
  );
}
