"use client";

import { FollowUps } from "@/components/FollowUps";
import { useRole } from "@/lib/role-context";

export default function FollowUpsPage() {
  const role = useRole();
  return <FollowUps role={role} />;
}
