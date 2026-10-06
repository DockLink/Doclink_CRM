"use client";

import { Dashboard } from "@/components/Dashboard";
import { useRole } from "@/lib/role-context";

export default function DashboardPage() {
  const role = useRole();
  return <Dashboard role={role} />;
}
