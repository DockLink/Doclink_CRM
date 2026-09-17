"use client";

import { Kanban } from "@/components/Kanban";
import { useRole } from "@/lib/role-context";

export default function PipelineKanbanPage() {
  const role = useRole();
  return <Kanban role={role} />;
}
