import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { Shell } from "@/components/Shell";
import { RoleProvider } from "@/lib/role-context";
import { createClient } from "@/lib/supabase/server";

export default async function CrmLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("name,role,is_active")
    .eq("email", user.email)
    .maybeSingle();

  const profileRole = profile?.is_active && (profile.role === "superadmin" || profile.role === "admin")
    ? profile.role
    : null;
  const metadataRole = user.app_metadata?.role;
  const role = profileRole ?? (
    metadataRole === "superadmin" || metadataRole === "admin" ? metadataRole : null
  );
  if (!role) redirect("/login?error=role_not_configured");

  const name = typeof profile?.name === "string" ? profile.name.trim() : "";

  return (
    <RoleProvider role={role} name={name} userId={user.id}>
      <Shell>{children}</Shell>
    </RoleProvider>
  );
}
