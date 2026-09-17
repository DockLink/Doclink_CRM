"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { UserRole } from "./types";

const RoleContext = createContext<UserRole>("superadmin");

export function RoleProvider({
  role = "superadmin",
  children,
}: {
  role?: UserRole;
  children: ReactNode;
}) {
  return <RoleContext.Provider value={role}>{children}</RoleContext.Provider>;
}

export function useRole(): UserRole {
  return useContext(RoleContext);
}
