"use client";

import { useParams, useRouter } from "next/navigation";
import { LeadDetailPanel } from "@/components/LeadDetailPanel";
import { useRole } from "@/lib/role-context";
import { notifyCrmDataChanged } from "@/lib/crm-invalidation";

export default function LeadDetailPage() {
  const role = useRole();
  const router = useRouter();
  const params = useParams<{ id: string }>();

  return (
    <div style={{ height: "calc(100vh - 64px)", background: "#F9FAFB", position: "relative" }}>
      <LeadDetailPanel
        role={role}
        leadId={params.id}
        initialTab="details"
        onClose={() => router.back()}
        onDelete={async (leadId) => {
          const response = await fetch("/api/leads", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ids: [leadId] }),
          });
          if (!response.ok) {
            const result = await response.json().catch(() => ({})) as { error?: string };
            throw new Error(result.error ?? "Unable to delete lead.");
          }
          notifyCrmDataChanged("leads", "followups", "dashboard", "notifications");
        }}
      />
    </div>
  );
}
