"use client";

import { Suspense } from "react";
import { Invoices } from "@/components/Invoices";
import { useCanAccessInvoices } from "@/lib/role-context";

function InvoicesGate() {
  const canAccess = useCanAccessInvoices();
  if (!canAccess) {
    return (
      <div className="flex items-center justify-center h-full" style={{ padding: 48 }}>
        <p style={{ fontSize: 14, color: "#6B7280" }}>Invoices are only accessible to Superadmins or granted Admins.</p>
      </div>
    );
  }
  return (
    <Suspense fallback={<div style={{ padding: 24, fontSize: 13, color: "#6B7280" }}>Loading invoices…</div>}>
      <Invoices />
    </Suspense>
  );
}

export default function InvoicesPage() {
  return <InvoicesGate />;
}
