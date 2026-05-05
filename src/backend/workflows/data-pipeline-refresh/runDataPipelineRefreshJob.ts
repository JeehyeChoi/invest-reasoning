// src/backend/workflows/data-pipeline-refresh/runDataPipelineRefreshJob.ts

import {
  addDataPipelineRefreshEvent,
  setDataPipelineRefreshStatus,
  updateDataPipelineRefreshStatus,
} from "./dataPipelineRefreshRuntimeState";
import {
  acquireDataPipelineRefreshLock,
  getDataPipelineRefreshLockState,
  releaseDataPipelineRefreshLock,
} from "./dataPipelineRefreshLock";
import {
  runDataPipelineRefreshWorkflow,
  type RunDataPipelineRefreshWorkflowInput,
} from "./runDataPipelineRefreshWorkflow";

export async function runDataPipelineRefreshJob(
  input: RunDataPipelineRefreshWorkflowInput = {},
) {
  const acquired = acquireDataPipelineRefreshLock();

  if (!acquired) {
    const lockState = getDataPipelineRefreshLockState();

    return {
      ok: false,
      status: "already_running" as const,
      startedAt: lockState.startedAt,
      ageMs: lockState.ageMs,
    };
  }

  const startedAt = new Date().toISOString();

  setDataPipelineRefreshStatus({
    status: "running",
    message: "Data pipeline refresh started.",
    startedAt,
    events: [
      {
        timestamp: startedAt,
        message: "Data pipeline refresh started.",
      },
    ],
  });

  runDataPipelineRefreshWorkflow(input)
    .then(() => {
      addDataPipelineRefreshEvent({
        message: "Data pipeline refresh completed.",
      });
      updateDataPipelineRefreshStatus({
        status: "idle",
        message:
          "No data pipeline refresh is running. Last refresh completed successfully.",
        finishedAt: new Date().toISOString(),
        currentJob: undefined,
        progress: undefined,
      });
    })
    .catch((error) => {
      const message = error instanceof Error ? error.message : String(error);

      addDataPipelineRefreshEvent({
        message: "Data pipeline refresh failed.",
        level: "error",
      });
      updateDataPipelineRefreshStatus({
        status: "failed",
        message: "Data pipeline refresh failed.",
        finishedAt: new Date().toISOString(),
        currentJob: undefined,
        progress: undefined,
        error: message,
      });
    })
    .finally(() => {
      releaseDataPipelineRefreshLock();
    });

  return {
    ok: true,
    status: "started" as const,
    startedAt,
  };
}
