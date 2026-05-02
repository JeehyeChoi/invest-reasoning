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
  events?: PipelineStatusEvent[];
  startedAt?: string;
  finishedAt?: string;
  updatedAt?: string;
  error?: string;
};
