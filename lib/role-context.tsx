"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { setDraftOwner } from "@/lib/use-form-draft";
import type { UserRole } from "./types";

const RoleContext = createContext<UserRole>("admin");
const InvoiceAccessContext = createContext(false);
const NameContext = createContext<{
  name: string;
  setName: (name: string) => void;
  setRole: (role: UserRole) => void;
  setCanAccessInvoices: (value: boolean) => void;
}>({
  name: "",
  setName: () => {},
  setRole: () => {},
  setCanAccessInvoices: () => {},
});

export function RoleProvider({
  role: initialRole = "admin",
  children,
}: {
  role?: UserRole;
  children: ReactNode;
}) {
  const [role, setRole] = useState<UserRole | null>(null);
  const [canAccessInvoices, setCanAccessInvoices] = useState(false);
  const [name, setName] = useState("");

  useEffect(() => {
    let mounted = true;
    void fetch("/api/session")
      .then(async (response) => {
        if (!response.ok) return null;
        const result = (await response.json()) as {
          session?: { id: string; name: string; role: UserRole; canAccessInvoices?: boolean };
        };
        return result.session ?? null;
      })
      .then((session) => {
        if (!mounted || !session) return;
        setDraftOwner(session.id);
        setRole(session.role);
        setName(session.name.trim());
        setCanAccessInvoices(session.role === "superadmin");
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
      <InvoiceAccessContext.Provider value={canAccessInvoices}>
        <NameContext.Provider value={{ name, setName, setRole, setCanAccessInvoices }}>
          {children}
        </NameContext.Provider>
      </InvoiceAccessContext.Provider>
    </RoleContext.Provider>
  );
}

export function useRole(): UserRole {
  return useContext(RoleContext);
}

export function useCanAccessInvoices(): boolean {
  return useContext(InvoiceAccessContext);
}

export function useDisplayName() {
  return useContext(NameContext);
}
