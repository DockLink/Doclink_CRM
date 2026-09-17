"use client";

import { PipelineList } from "@/components/PipelineList";
import { useRole } from "@/lib/role-context";

export default function PipelineListPage() {
  const role = useRole();
  return <PipelineList role={role} />;
}
