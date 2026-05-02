// src/backend/workflows/data-pipeline-refresh/dataPipelineRefreshRuntimeState.ts

import type { PipelineStatus } from "@/shared/data-pipeline/status";

const MAX_STATUS_EVENTS = 50;

let status: PipelineStatus = {
  status: "idle",
  message: "No data pipeline refresh has been started yet.",
};

export function getDataPipelineRefreshStatus(): PipelineStatus {
  if (status.status === "success") {
    return {
      ...status,
      status: "idle",
      message:
        "No data pipeline refresh is running. Last refresh completed successfully.",
      currentJob: undefined,
      progress: undefined,
    };
  }

  return status;
}

export function setDataPipelineRefreshStatus(next: PipelineStatus) {
  status = {
    ...next,
    updatedAt: next.updatedAt ?? new Date().toISOString(),
  };
}

export function updateDataPipelineRefreshStatus(
  patch: Partial<PipelineStatus>,
) {
  status = {
    ...status,
    ...patch,
    updatedAt: patch.updatedAt ?? new Date().toISOString(),
  };
}

export function addDataPipelineRefreshEvent(
  event: Omit<NonNullable<PipelineStatus["events"]>[number], "timestamp">,
) {
  const timestamp = new Date().toISOString();

  status = {
    ...status,
    message: event.message,
    updatedAt: timestamp,
    events: [
      ...(status.events ?? []),
      {
        ...event,
        timestamp,
      },
    ].slice(-MAX_STATUS_EVENTS),
  };
}
