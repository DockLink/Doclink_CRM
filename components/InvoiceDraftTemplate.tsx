"use client";

import type { CSSProperties, ReactNode } from "react";
import { InvoiceCornerHeader } from "@/components/InvoiceCornerHeader";
import { computeInvoiceTotals, computeLineTotal, formatMoney } from "@/lib/invoice-format";

export type InvoiceDraftLineItem = {
  id?: string;
  description: string;
  qty: number;
  unitPrice: string;
};

export type InvoiceDraftValues = {
  invoiceNumber?: string | null;
  clientType: "new" | "existing";
  invoiceDate: string;
  dueDate: string;
  currency: string;
  billToName: string;
  billToCompany: string;
  billToLine1: string;
  billToLine2: string;
  billToCity: string;
  billToPostal: string;
  bankName: string;
  accountName: string;
  accountNumber: string;
  paymentAccountType?: "savings" | "current" | null;
  paymentAccounts?: Array<{ accountType: "savings" | "current"; bankName: string; accountName: string; accountNumber: string }>;
  discountPercent: string;
  lineItems: InvoiceDraftLineItem[];
  termsAndConditions?: string | null;
  companyName?: string;
  companyPhone?: string;
  companyEmail?: string;
  companyWebsite?: string;
};

const YELLOW = "#FCD144";
const BLUE = "#2B65B5";
const INK = "#1A1A1A";
const MUTED = "#4B5563";
const RULE = "#D1D5DB";

const inputStyle: CSSProperties = {
  height: 34,
  width: "100%",
  border: "1.5px solid #E3E7EF",
  borderRadius: 8,
  padding: "0 10px",
  fontSize: 13,
  color: INK,
  background: "#FFFFFF",
  outline: "none",
};

const readOnlyStyle: CSSProperties = {
  ...inputStyle,
  background: "#F9FAFB",
  color: "#374151",
};

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span style={{ fontSize: 11, fontWeight: 600, color: MUTED, textTransform: "uppercase", letterSpacing: "0.04em" }}>
        {label}
      </span>
      {children}
    </label>
  );
}

function formatDisplayDate(isoDate: string) {
  if (!isoDate) return "—";
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate);
  if (!match) return isoDate;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  });
}

function LineItemsEditor({
  lineItems,
  currency,
  onChange,
  readOnly,
}: {
  lineItems: InvoiceDraftLineItem[];
  currency: string;
  onChange: (items: InvoiceDraftLineItem[]) => void;
  readOnly: boolean;
}) {
  return (
    <div className="flex flex-col gap-0">
      <div
        className="grid gap-2 px-3 py-2.5"
        style={{
          gridTemplateColumns: "1fr 70px 120px 120px 36px",
          background: YELLOW,
          fontSize: 11,
          fontWeight: 700,
          color: INK,
          textTransform: "uppercase",
          letterSpacing: "0.04em",
        }}
      >
        <span>DESCRIPTION</span>
        <span style={{ textAlign: "right" }}>QTY</span>
        <span style={{ textAlign: "right" }}>UNIT PRICE</span>
        <span style={{ textAlign: "right" }}>TOTAL</span>
        <span />
      </div>
      {lineItems.map((item, index) => {
        const lineTotal = computeLineTotal(item.qty, Number(item.unitPrice) || 0);
        return (
          <div
            key={item.id ?? index}
            className="grid gap-2 items-center px-3 py-2"
            style={{ gridTemplateColumns: "1fr 70px 120px 120px 36px" }}
          >
            <input
              style={readOnly ? readOnlyStyle : inputStyle}
              disabled={readOnly}
              placeholder="Description"
              value={item.description}
              onChange={(e) => {
                const next = [...lineItems];
                next[index] = { ...item, description: e.target.value };
                onChange(next);
              }}
            />
            <input
              type="number"
              min={1}
              style={{ ...(readOnly ? readOnlyStyle : inputStyle), textAlign: "right" }}
              disabled={readOnly}
              value={item.qty}
              onChange={(e) => {
                const next = [...lineItems];
                next[index] = { ...item, qty: Math.max(1, Number(e.target.value) || 1) };
                onChange(next);
              }}
            />
            <input
              style={{ ...(readOnly ? readOnlyStyle : inputStyle), textAlign: "right" }}
              disabled={readOnly}
              placeholder="0.00"
              value={item.unitPrice}
              onChange={(e) => {
                const next = [...lineItems];
                next[index] = { ...item, unitPrice: e.target.value };
                onChange(next);
              }}
            />
            <div style={{ fontSize: 13, fontWeight: 600, color: INK, textAlign: "right", paddingRight: 4 }}>
              {formatMoney(lineTotal, currency)}
            </div>
            {!readOnly ? (
              <button
                type="button"
                onClick={() => onChange(lineItems.filter((_, i) => i !== index))}
                style={{ background: "none", border: "none", color: "#DC2626", cursor: "pointer", fontSize: 18 }}
                aria-label="Remove line"
              >
                ×
              </button>
            ) : (
              <span />
            )}
          </div>
        );
      })}
      {!readOnly && (
        <button
          type="button"
          onClick={() => onChange([...lineItems, { description: "", qty: 1, unitPrice: "" }])}
          style={{
            alignSelf: "flex-start",
            background: "none",
            border: "none",
            color: INK,
            fontWeight: 600,
            fontSize: 12,
            cursor: "pointer",
            padding: "8px 12px",
          }}
        >
          + Add line
        </button>
      )}
    </div>
  );
}

export function InvoiceDraftTemplate({
  values,
  onChange,
  readOnly = false,
  clientPicker,
}: {
  values: InvoiceDraftValues;
  onChange: (patch: Partial<InvoiceDraftValues>) => void;
  readOnly?: boolean;
  clientPicker?: ReactNode;
}) {
  const style = readOnly ? readOnlyStyle : inputStyle;
  const totals = computeInvoiceTotals(
    values.lineItems.map((item) => ({ qty: item.qty, unitPrice: Number(item.unitPrice) || 0 })),
    Number(values.discountPercent) || 0,
  );
  const terms = (values.termsAndConditions ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  return (
    <div className="rounded-xl overflow-hidden relative" style={{ background: "#FFFFFF", border: "1px solid #E3E7EF" }}>
      <InvoiceCornerHeader />

      <div className="px-6 pt-5 pb-0 flex flex-col gap-5 relative z-[1]">
        <div>
          <img
            src="/branding/doclink-logo.jpg"
            alt={values.companyName || "DocLink"}
            style={{ width: 96, height: 96, objectFit: "contain", display: "block" }}
          />
        </div>

        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div style={{ fontSize: 42, fontWeight: 800, color: INK, letterSpacing: "0.02em", lineHeight: 1 }}>
            INVOICE
          </div>
          {readOnly ? (
            <div className="flex flex-col items-end gap-1" style={{ fontSize: 13, color: BLUE, minWidth: 220 }}>
              <div>Invoice No: {values.invoiceNumber || "—"}</div>
              <div>Invoice Date: {formatDisplayDate(values.invoiceDate)}</div>
              <div>Due Date: {formatDisplayDate(values.dueDate)}</div>
            </div>
          ) : (
            <div className="flex flex-col gap-2" style={{ minWidth: 220 }}>
              <Field label="Invoice No (automatic)">
                <input style={{ ...readOnlyStyle, fontWeight: 700 }} disabled value={values.invoiceNumber ?? "Assigned on create"} />
              </Field>
              <Field label="Invoice date">
                <input
                  type="date"
                  style={style}
                  disabled={readOnly}
                  value={values.invoiceDate}
                  onChange={(e) => onChange({ invoiceDate: e.target.value })}
                />
              </Field>
              <Field label="Due date">
                <input
                  type="date"
                  style={style}
                  disabled={readOnly}
                  value={values.dueDate}
                  onChange={(e) => onChange({ dueDate: e.target.value })}
                />
              </Field>
            </div>
          )}
        </div>

        {clientPicker}

        {!readOnly && (
          <div className="flex gap-2">
            {(["new", "existing"] as const).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => onChange({ clientType: type })}
                className="rounded-lg px-3 font-semibold"
                style={{
                  height: 32,
                  fontSize: 12,
                  background: values.clientType === type ? YELLOW : "#F9FAFB",
                  color: values.clientType === type ? INK : MUTED,
                  border: `1px solid ${values.clientType === type ? YELLOW : "#E5E7EB"}`,
                }}
              >
                {type === "new" ? "New client" : "Existing client"}
              </button>
            ))}
          </div>
        )}

        <div className="grid gap-5" style={{ gridTemplateColumns: "1fr 1fr" }}>
          <div className="flex flex-col gap-3" style={{ borderTop: `1px solid ${RULE}`, paddingTop: 10 }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, color: INK }}>Bill To:</h3>
            <Field label="Name">
              <input style={style} disabled={readOnly} value={values.billToName} onChange={(e) => onChange({ billToName: e.target.value })} />
            </Field>
            <Field label="Company">
              <input style={style} disabled={readOnly} value={values.billToCompany} onChange={(e) => onChange({ billToCompany: e.target.value })} />
            </Field>
            <Field label="Address">
              <input style={style} disabled={readOnly} value={values.billToLine1} onChange={(e) => onChange({ billToLine1: e.target.value })} />
            </Field>
            <Field label="Address line 2">
              <input style={style} disabled={readOnly} value={values.billToLine2} onChange={(e) => onChange({ billToLine2: e.target.value })} />
            </Field>
            <div className="grid gap-3" style={{ gridTemplateColumns: "1fr 1fr" }}>
              <Field label="City">
                <input style={style} disabled={readOnly} value={values.billToCity} onChange={(e) => onChange({ billToCity: e.target.value })} />
              </Field>
              <Field label="Postal Code">
                <input style={style} disabled={readOnly} value={values.billToPostal} onChange={(e) => onChange({ billToPostal: e.target.value })} />
              </Field>
            </div>
          </div>

          <div className="flex flex-col gap-3" style={{ borderTop: `1px solid ${RULE}`, paddingTop: 10 }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, color: INK }}>Payment information:</h3>
            {values.paymentAccounts && values.paymentAccounts.length > 0 && (
              <Field label="Account shown on invoice">
                <select
                  style={style}
                  disabled={readOnly}
                  value={values.paymentAccountType ?? ""}
                  onChange={(e) => {
                    const selected = values.paymentAccounts?.find((account) => account.accountType === e.target.value);
                    onChange({
                      paymentAccountType: selected?.accountType ?? null,
                      bankName: selected?.bankName ?? values.bankName,
                      accountName: selected?.accountName ?? values.accountName,
                      accountNumber: selected?.accountNumber ?? values.accountNumber,
                    });
                  }}
                >
                  <option value="">All company accounts</option>
                  {values.paymentAccounts.map((account) => <option key={account.accountType} value={account.accountType}>{account.accountType} account</option>)}
                </select>
              </Field>
            )}
            <Field label="Bank">
              <input style={style} disabled={readOnly} value={values.bankName} onChange={(e) => onChange({ bankName: e.target.value })} />
            </Field>
            <Field label="Account Name">
              <input style={style} disabled={readOnly} value={values.accountName} onChange={(e) => onChange({ accountName: e.target.value })} />
            </Field>
            <Field label="Account No">
              <input style={style} disabled={readOnly} value={values.accountNumber} onChange={(e) => onChange({ accountNumber: e.target.value })} />
            </Field>
            <Field label="Currency">
              <select
                style={style}
                disabled={readOnly}
                value={values.currency}
                onChange={(e) => onChange({ currency: e.target.value })}
              >
                <option value="LKR">LKR</option>
                <option value="USD">USD</option>
              </select>
            </Field>
          </div>
        </div>

        <div className="flex flex-col gap-0">
          <LineItemsEditor
            lineItems={values.lineItems}
            currency={values.currency}
            readOnly={readOnly}
            onChange={(lineItems) => onChange({ lineItems })}
          />
        </div>

        <div className="flex items-end justify-between gap-4 flex-wrap px-1">
          <Field label="Discount percentage">
            <input
              style={{ ...style, maxWidth: 200 }}
              disabled={readOnly}
              type="number"
              min={0}
              step="0.01"
              value={values.discountPercent}
              onChange={(e) => onChange({ discountPercent: e.target.value })}
            />
            {Number(values.discountPercent) > 100 && (
              <div style={{ color: "#B91C1C", fontSize: 11, marginTop: 4 }}>Discount percentage must be between 0 and 100</div>
            )}
          </Field>
          <div style={{ fontSize: 13, color: INK, minWidth: 220 }}>
            <div className="flex justify-between gap-8 py-1">
              <span>Subtotal:</span>
              <span style={{ fontWeight: 700 }}>{formatMoney(totals.subtotal, values.currency)}</span>
            </div>
            {Number(values.discountPercent) > 0 && Number(values.discountPercent) <= 100 && (
              <div className="flex justify-between gap-8 py-1">
                <span>Discount ({values.discountPercent}%):</span>
                <span style={{ fontWeight: 700 }}>-{formatMoney(totals.discountAmount, values.currency)}</span>
              </div>
            )}
          </div>
        </div>

        <div
          className="flex items-center justify-between px-3 py-3"
          style={{ background: YELLOW, fontWeight: 700, fontSize: 15, color: INK }}
        >
          <span>TOTAL AMOUNT</span>
          <span>{formatMoney(totals.total, values.currency)}</span>
        </div>

        {terms.length > 0 && (
          <div>
            <h3
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: INK,
                marginBottom: 10,
                textDecoration: "underline",
              }}
            >
              TERMS AND CONDITIONS
            </h3>
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {terms.map((line) => (
                <li key={line} style={{ fontSize: 12, color: MUTED, lineHeight: 1.5, marginBottom: 6 }}>
                  {line}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div
        className="mt-6 flex items-center justify-between gap-3 px-6 py-2.5"
        style={{ background: YELLOW, fontSize: 12, color: INK }}
      >
        <span>{values.companyPhone || "+94 76 567 2814"}</span>
        <span>{values.companyWebsite || "doclinkcare.com"}</span>
        <span>{values.companyEmail || "info@doclinkcare.com"}</span>
      </div>
    </div>
  );
}
