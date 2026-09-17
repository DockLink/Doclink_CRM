"use client";

import { Settings } from "@/components/Settings";
import { useRole } from "@/lib/role-context";

export default function SettingsPage() {
  const role = useRole();
  return <Settings role={role} />;
}
