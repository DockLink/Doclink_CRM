"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";
import { setDraftOwner } from "@/lib/use-form-draft";
import type { UserRole } from "./types";

const RoleContext = createContext<UserRole>("admin");
const NameContext = createContext<{ name: string; setName: (name: string) => void; setRole: (role: UserRole) => void }>({
  name: "",
  setName: () => {},
  setRole: () => {},
});

export function RoleProvider({
  role: initialRole = "admin",
  children,
}: {
  role?: UserRole;
  children: ReactNode;
}) {
  const [role, setRole] = useState<UserRole | null>(null);
  const [name, setName] = useState("");

  useEffect(() => {
    let mounted = true;
    const supabase = createClient();

    void supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user?.email) return;

      const { data: profile } = await supabase
        .from("users")
        .select("name,role,is_active")
        .eq("email", user.email)
        .maybeSingle();

      const profileRole = profile?.is_active && (profile.role === "superadmin" || profile.role === "admin")
        ? profile.role
        : null;
      const metadataRole = user.app_metadata?.role;
      const resolvedRole = profileRole ?? (
        metadataRole === "superadmin" || metadataRole === "admin" ? metadataRole : null
      );

      const profileName = typeof profile?.name === "string" ? profile.name.trim() : "";
      if (mounted) {
        setDraftOwner(user.id);
        setRole(resolvedRole);
        setName(profileName);
      }
    });

    return () => {
      mounted = false;
    };
  }, []);

  if (!role) return null;

  return (
    <RoleContext.Provider value={role}>
      <NameContext.Provider value={{ name, setName, setRole }}>{children}</NameContext.Provider>
    </RoleContext.Provider>
  );
}

export function useRole(): UserRole {
  return useContext(RoleContext);
}

export function useDisplayName() {
  return useContext(NameContext);
}
