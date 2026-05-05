// src/backend/workflows/data-pipeline-refresh/dataPipelineRefreshRuntimeState.ts

import type { PipelineStatus } from "@/shared/data-pipeline/status";

const MAX_STATUS_EVENTS = 200;

type DataPipelineRefreshRuntimeGlobal = typeof globalThis & {
  __geoPortfolioDataPipelineRefreshStatus?: PipelineStatus;
};

const runtimeGlobal = globalThis as DataPipelineRefreshRuntimeGlobal;

function getStoredStatus(): PipelineStatus {
  runtimeGlobal.__geoPortfolioDataPipelineRefreshStatus ??= {
    status: "idle",
    message: "No data pipeline refresh has been started yet.",
  };

  return runtimeGlobal.__geoPortfolioDataPipelineRefreshStatus;
}

function setStoredStatus(next: PipelineStatus) {
  runtimeGlobal.__geoPortfolioDataPipelineRefreshStatus = next;
}

export function getDataPipelineRefreshStatus(): PipelineStatus {
  const status = getStoredStatus();

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
  setStoredStatus({
    ...next,
    updatedAt: next.updatedAt ?? new Date().toISOString(),
  });
}

export function updateDataPipelineRefreshStatus(
  patch: Partial<PipelineStatus>,
) {
  setStoredStatus({
    ...getStoredStatus(),
    ...patch,
    updatedAt: patch.updatedAt ?? new Date().toISOString(),
  });
}

export function addDataPipelineRefreshEvent(
  event: Omit<NonNullable<PipelineStatus["events"]>[number], "timestamp">,
) {
  const timestamp = new Date().toISOString();
  const status = getStoredStatus();

  setStoredStatus({
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
  });
}
