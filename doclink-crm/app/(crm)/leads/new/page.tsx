"use client";

import { useRouter } from "next/navigation";
import { AddLeadModal } from "@/components/AddLeadModal";
import { useRole } from "@/lib/role-context";

export default function AddLeadPage() {
  const role = useRole();
  const router = useRouter();

  return (
    <div
      style={{
        minHeight: "calc(100vh - 64px)",
        background: "#F9FAFB",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <AddLeadModal
        role={role}
        onClose={() => router.push("/pipeline/list")}
      />
    </div>
  );
}
