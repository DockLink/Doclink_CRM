"use client";

import { useRouter } from "next/navigation";
import { LeadDetailPanel } from "@/components/LeadDetailPanel";
import { useRole } from "@/lib/role-context";

export default function LeadDetailPage() {
  const role = useRole();
  const router = useRouter();

  return (
    <div style={{ height: "calc(100vh - 64px)", background: "#F9FAFB", position: "relative" }}>
      <LeadDetailPanel
        role={role}
        initialTab="details"
        onClose={() => router.back()}
      />
    </div>
  );
}
