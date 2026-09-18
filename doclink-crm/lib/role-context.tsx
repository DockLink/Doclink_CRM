"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";
import type { UserRole } from "./types";

const RoleContext = createContext<UserRole>("admin");

export function RoleProvider({
  role: initialRole = "admin",
  children,
}: {
  role?: UserRole;
  children: ReactNode;
}) {
  const [role, setRole] = useState<UserRole | null>(null);

  useEffect(() => {
    let mounted = true;
    const supabase = createClient();

    void supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user?.email) return;

      const { data: profile } = await supabase
        .from("users")
        .select("role,is_active")
        .eq("email", user.email)
        .maybeSingle();

      const profileRole = profile?.is_active && (profile.role === "superadmin" || profile.role === "admin")
        ? profile.role
        : null;
      const metadataRole = user.app_metadata?.role;
      const resolvedRole = profileRole ?? (
        metadataRole === "superadmin" || metadataRole === "admin" ? metadataRole : null
      );

      if (mounted) setRole(resolvedRole);
    });

    return () => {
      mounted = false;
    };
  }, []);

  if (!role) return null;

  return <RoleContext.Provider value={role}>{children}</RoleContext.Provider>;
}

export function useRole(): UserRole {
  return useContext(RoleContext);
}
