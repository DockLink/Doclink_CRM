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
  role: initialRole,
  name: initialName,
  userId,
  children,
}: {
  role: UserRole;
  name: string;
  userId: string;
  children: ReactNode;
}) {
  const [role, setRole] = useState<UserRole>(initialRole);
  const [name, setName] = useState(initialName);
  const [draftOwnerReady, setDraftOwnerReady] = useState(false);

  // Forms read drafts while rendering, so they must not mount before the owner is set.
  useEffect(() => {
    setDraftOwner(userId);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDraftOwnerReady(true);
  }, [userId]);

  if (!draftOwnerReady) return null;

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
