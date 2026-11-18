"use client";

import { use } from "react";
import { useCanAccessInvoices } from "@/lib/role-context";
import { ClientInvoiceFolder } from "@/components/ClientInvoiceFolder";

export default function ClientInvoiceFolderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const canAccess = useCanAccessInvoices();
  if (!canAccess) {
    return <div className="flex items-center justify-center h-full" style={{ padding: 48 }}>Invoices are only accessible to Superadmins.</div>;
  }
  return <ClientInvoiceFolder clientId={id} />;
}
