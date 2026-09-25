"use client";

import { useCallback, useEffect, useState } from "react";
import { type PipelineStage } from "@/lib/pipeline-stages";

let cached: PipelineStage[] | null = null;
let inflight: Promise<PipelineStage[]> | null = null;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((listener) => listener());
}

async function fetchStages(force = false): Promise<PipelineStage[]> {
  if (!force && cached) return cached;
  if (!force && inflight) return inflight;

  inflight = fetch("/api/pipeline-stages")
    .then(async (response) => {
      const result = await response.json() as { stages?: PipelineStage[]; error?: string };
      if (!response.ok) throw new Error(result.error ?? "Unable to load stages.");
      cached = result.stages ?? [];
      notify();
      return cached;
    })
    .finally(() => {
      inflight = null;
    });

  return inflight;
}

export function usePipelineStages() {
  const [stages, setStages] = useState<PipelineStage[]>(cached ?? []);
  const [loading, setLoading] = useState(cached === null);
  const [error, setError] = useState("");

  useEffect(() => {
    const sync = () => {
      if (cached) {
        setStages(cached);
        setLoading(false);
      }
    };
    listeners.add(sync);
    if (cached) {
      setStages(cached);
      setLoading(false);
    } else {
      void fetchStages()
        .then((next) => {
          setStages(next);
          setError("");
        })
        .catch((err: unknown) => {
          setError(err instanceof Error ? err.message : "Unable to load stages.");
        })
        .finally(() => setLoading(false));
    }
    return () => {
      listeners.delete(sync);
    };
  }, []);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const next = await fetchStages(true);
      setStages(next);
      setError("");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unable to load stages.");
    } finally {
      setLoading(false);
    }
  }, []);

  return { stages, loading, error, reload };
}
