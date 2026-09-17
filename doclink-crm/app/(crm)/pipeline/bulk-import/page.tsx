"use client";

import { useRouter } from "next/navigation";
import { BulkImport } from "@/components/BulkImport";
import { useRole } from "@/lib/role-context";

export default function BulkImportPage() {
  const role = useRole();
  const router = useRouter();

  return (
    <BulkImport
      role={role}
      onNavigate={(page) => {
        if (page === "pipeline-list") router.push("/pipeline/list");
        else if (page === "pipeline-kanban") router.push("/pipeline/kanban");
      }}
    />
  );
}
