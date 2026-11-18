"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { InvoiceCreate } from "@/components/InvoiceEditor";
import { useCanAccessInvoices } from "@/lib/role-context";

function NewInvoiceInner() {
  const searchParams = useSearchParams();
  const clientId = searchParams.get("clientId") ?? searchParams.get("leadId") ?? undefined;
  return <InvoiceCreate initialClientId={clientId} />;
}

export default function NewInvoicePage() {
  const canAccess = useCanAccessInvoices();
  if (!canAccess) {
    return (
      <div className="flex items-center justify-center h-full" style={{ padding: 48 }}>
        <p style={{ fontSize: 14, color: "#6B7280" }}>Invoices are only accessible to Superadmins.</p>
      </div>
    );
  }
  return (
    <Suspense fallback={<div style={{ padding: 24, fontSize: 13, color: "#6B7280" }}>Loading…</div>}>
      <NewInvoiceInner />
    </Suspense>
  );
}
