"use client";

import { use } from "react";
import { InvoiceDetail } from "@/components/InvoiceEditor";
import { useCanAccessInvoices } from "@/lib/role-context";

export default function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const canAccess = useCanAccessInvoices();
  if (!canAccess) {
    return (
      <div className="flex items-center justify-center h-full" style={{ padding: 48 }}>
        <p style={{ fontSize: 14, color: "#6B7280" }}>Invoices are only accessible to Superadmins or granted Admins.</p>
      </div>
    );
  }
  return <InvoiceDetail invoiceId={id} />;
}
