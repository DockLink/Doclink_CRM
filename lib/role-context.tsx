"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
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
    void fetch("/api/session")
      .then(async (response) => {
        if (!response.ok) return null;
        const result = (await response.json()) as {
          session?: { id: string; name: string; role: UserRole };
        };
        return result.session ?? null;
      })
      .then((session) => {
        if (!mounted || !session) return;
        setDraftOwner(session.id);
        setRole(session.role);
        setName(session.name.trim());
      })
      .catch((error: unknown) => {
        console.error("Unable to load the authenticated CRM session.", error);
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
