"use client";

import { useCallback, useEffect, useState } from "react";
import { onCrmDataChanged } from "@/lib/crm-invalidation";

export interface DashboardFollowUp {
  id: string;
  company: string;
  contact: string;
  stage: string;
  followUpDate: string | null;
  followUpTime: string | null;
}

export interface DashboardStageHealth {
  stage: string;
  count: number;
  pct: number;
  avgDays: number;
}

export interface DashboardTeamMember {
  id: string;
  name: string;
  initials: string;
  callsToday: number;
  callsWeek: number;
  updatedToday: number;
  convRate: number;
}

export interface DashboardLostReason {
  reason: string;
  count: number;
}

export interface DashboardData {
  role: "superadmin" | "admin";
  kpis: {
    totalLeads: number;
    closedWon: number;
    closedLost: number;
    deadLeads: number;
    winRate: number;
    noActivityCount: number;
    noStatusUpdateCount: number;
    missedFollowUpsCount: number;
  };
  followUps: {
    today: DashboardFollowUp[];
    missed: DashboardFollowUp[];
    upcoming: DashboardFollowUp[];
  };
  pipelineHealth: {
    totalLeads: number;
    overdueCount: number;
    stages: DashboardStageHealth[];
  };
  teamActivity: DashboardTeamMember[] | null;
  lostReasons: DashboardLostReason[] | null;
}

export function useDashboardData() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/dashboard?tzOffset=${new Date().getTimezoneOffset()}`);
      const result = (await response.json()) as DashboardData & { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Unable to load dashboard data.");
      setData(result);
      setError("");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unable to load dashboard data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const removeInvalidationListener = onCrmDataChanged(
      ["leads", "followups", "dashboard"],
      () => void load(),
    );
    const timer = window.setInterval(() => void load(), 60_000);
    return () => {
      removeInvalidationListener();
      window.clearInterval(timer);
    };
  }, [load]);

  return { data, loading, error, reload: load };
}