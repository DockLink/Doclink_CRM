"use client";

import { InvoiceSettingsPanel } from "@/components/InvoiceSettingsPanel";
import { useCanAccessInvoices } from "@/lib/role-context";

export default function InvoiceSettingsPage() {
  const canAccess = useCanAccessInvoices();
  if (!canAccess) return <div style={{ padding: 48 }}>Invoices are not accessible.</div>;
  return <InvoiceSettingsPanel />;
}
