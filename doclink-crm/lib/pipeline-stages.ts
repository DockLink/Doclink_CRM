export interface PipelineStage {
  id: string;
  name: string;
  color: string;
  leads: number;
  active: boolean;
  isDefault: boolean;
  position: number;
}

export const FALLBACK_STAGE_COLOR = "#94A3B8";

export function activeStages(stages: PipelineStage[]) {
  return stages.filter((stage) => stage.active);
}

export function stageColor(stages: PipelineStage[], name: string) {
  return stages.find((stage) => stage.name === name)?.color ?? FALLBACK_STAGE_COLOR;
}

export function nextStageName(stages: PipelineStage[], current: string) {
  const ordered = activeStages(stages);
  const index = ordered.findIndex((stage) => stage.name === current);
  if (index < 0) return undefined;
  return ordered[index + 1]?.name;
}
