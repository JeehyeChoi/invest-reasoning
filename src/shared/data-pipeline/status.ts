import type { DataPipelineRefreshJobKey } from "./jobs";

export type PipelineProgress = {
  current?: number;
  total?: number;
  label?: string;
};

export type PipelineStatusEvent = {
  timestamp: string;
  message: string;
  job?: DataPipelineRefreshJobKey;
  level?: "info" | "warning" | "error";
};

export type PipelineStatus = {
  status: "idle" | "running" | "success" | "failed";
  message?: string;
  currentJob?: DataPipelineRefreshJobKey;
  progress?: PipelineProgress;
  activeRuns?: PipelineActiveRun[];
  completedRuns?: PipelineCompletedRun[];
  events?: PipelineStatusEvent[];
  startedAt?: string;
  finishedAt?: string;
  updatedAt?: string;
  error?: string;
};

export type PipelineActiveRun = {
  slot: number;
  id: string;
  startedAt: string;
  ageMs: number;
  jobs: DataPipelineRefreshJobKey[];
  groups: string[];
};

export type PipelineCompletedRun = {
  slot: number;
  id: string;
  status: "success" | "failed";
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  jobs: DataPipelineRefreshJobKey[];
};
