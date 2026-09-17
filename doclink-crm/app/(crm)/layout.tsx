"use client";

import type { ReactNode } from "react";
import { Shell } from "@/components/Shell";
import { RoleProvider } from "@/lib/role-context";

export default function CrmLayout({ children }: { children: ReactNode }) {
  return (
    <RoleProvider role="superadmin">
      <Shell>{children}</Shell>
    </RoleProvider>
  );
}
