// src/backend/workflows/data-pipeline-refresh/runDataPipelineRefreshJob.ts

import {
  addDataPipelineRefreshCompletedRun,
  addDataPipelineRefreshEvent,
  getDataPipelineRefreshStatus,
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
import {
  DATA_PIPELINE_REFRESH_JOB_KEYS,
  DATA_PIPELINE_REFRESH_JOB_LABELS,
  type DataPipelineRefreshJobKey,
} from "@/shared/data-pipeline/jobs";

const DEFAULT_DATA_PIPELINE_REFRESH_JOBS: DataPipelineRefreshJobKey[] =
  DATA_PIPELINE_REFRESH_JOB_KEYS.filter(
    (job) =>
      job !== "universe_memberships_sync" &&
      job !== "ticker_core_sync" &&
      job !== "ticker_daily_price_history_sync" &&
      job !== "sec_metric_series_experiment",
  );

export async function runDataPipelineRefreshJob(
  input: RunDataPipelineRefreshWorkflowInput = {},
  options: { targetSlot?: number } = {},
) {
  const requestedJobs = normalizeRequestedJobs(input.jobs);
  const lockResult = acquireDataPipelineRefreshLock({
    jobs: requestedJobs,
    targetSlot: options.targetSlot,
  });

  if (!lockResult.acquired) {
    return {
      ok: false,
      status: "already_running" as const,
      reason: lockResult.reason,
      message:
        lockResult.reason === "conflict"
          ? `A conflicting data pipeline job is already running: ${lockResult.conflictingGroups?.join(", ")}.`
          : options.targetSlot
            ? `Slot ${options.targetSlot} is already running.`
            : "Two data pipeline jobs are already running.",
      activeCount: lockResult.activeCount,
      startedAt: lockResult.startedAt,
      ageMs: lockResult.ageMs,
    };
  }

  const lock = lockResult.lock;
  const startedAt = lock.startedAt;
  const jobLabels = requestedJobs.map((job) => DATA_PIPELINE_REFRESH_JOB_LABELS[job]);

  if (lockResult.activeCount === 1) {
    setDataPipelineRefreshStatus({
      status: "running",
      message: "Data pipeline refresh started.",
      startedAt,
      events: [
        {
          timestamp: startedAt,
          message: `Data pipeline refresh started. slot=${lock.slot}, jobs=${jobLabels.join(", ")}.`,
        },
      ],
    });
  } else {
    const currentStatus = getDataPipelineRefreshStatus();
    updateDataPipelineRefreshStatus({
      status: "running",
      message: `Data pipeline refresh started. slot=${lock.slot}.`,
      startedAt: currentStatus.startedAt ?? startedAt,
      finishedAt: undefined,
      error: undefined,
    });
    addDataPipelineRefreshEvent({
      message: `Data pipeline refresh started. slot=${lock.slot}, jobs=${jobLabels.join(", ")}.`,
    });
  }

  runDataPipelineRefreshWorkflow(input)
    .then(() => ({ ok: true as const }))
    .catch((error) => ({
      ok: false as const,
      error,
      message: error instanceof Error ? error.message : String(error),
    }))
    .then((result) => {
      const finishedAt = new Date().toISOString();
      const durationMs = Math.max(
        0,
        new Date(finishedAt).getTime() - new Date(startedAt).getTime(),
      );
      const remainingLockState = releaseDataPipelineRefreshLock(lock.id);

      addDataPipelineRefreshCompletedRun({
        slot: lock.slot,
        id: lock.id,
        status: result.ok ? "success" : "failed",
        startedAt,
        finishedAt,
        durationMs,
        jobs: requestedJobs,
      });

      if (result.ok) {
        addDataPipelineRefreshEvent({
          message: "Data pipeline refresh completed.",
        });
      } else {
        addDataPipelineRefreshEvent({
          message: "Data pipeline refresh failed.",
          level: "error",
        });
      }

      if (remainingLockState.isRunning) {
        updateDataPipelineRefreshStatus({
          status: "running",
          message: result.ok
            ? `Data pipeline refresh completed. ${remainingLockState.activeCount} job still running.`
            : `Data pipeline refresh failed. ${remainingLockState.activeCount} job still running.`,
          currentJob: undefined,
          progress: undefined,
          error: result.ok ? undefined : result.message,
        });
        return;
      }

      if (result.ok) {
        updateDataPipelineRefreshStatus({
          status: "idle",
          message:
            "No data pipeline refresh is running. Last refresh completed successfully.",
          finishedAt,
          currentJob: undefined,
          progress: undefined,
        });
        return;
      }

      addDataPipelineRefreshEvent({
        message: result.message,
        level: "error",
      });
      updateDataPipelineRefreshStatus({
        status: "failed",
        message: "Data pipeline refresh failed.",
        finishedAt,
        currentJob: undefined,
        progress: undefined,
        error: result.message,
      });
    })
    .catch((error) => {
      const finishedAt = new Date().toISOString();
      const durationMs = Math.max(
        0,
        new Date(finishedAt).getTime() - new Date(startedAt).getTime(),
      );
      releaseDataPipelineRefreshLock(lock.id);
      const message = error instanceof Error ? error.message : String(error);

      addDataPipelineRefreshCompletedRun({
        slot: lock.slot,
        id: lock.id,
        status: "failed",
        startedAt,
        finishedAt,
        durationMs,
        jobs: requestedJobs,
      });

      addDataPipelineRefreshEvent({
        message: "Data pipeline refresh failed.",
        level: "error",
      });
      updateDataPipelineRefreshStatus({
        status: "failed",
        message: "Data pipeline refresh failed.",
        finishedAt,
        currentJob: undefined,
        progress: undefined,
        error: message,
      });
    });

  return {
    ok: true,
    status: "started" as const,
    activeCount: lockResult.activeCount,
    slot: lock.slot,
    startedAt,
  };
}

function normalizeRequestedJobs(
  jobs: DataPipelineRefreshJobKey[] | undefined,
): DataPipelineRefreshJobKey[] {
  const requestedJobs = jobs ?? DEFAULT_DATA_PIPELINE_REFRESH_JOBS;
  const normalizedJobs = requestedJobs.filter(
    (job) =>
      job !== "metric_series" || requestedJobs.includes("sec_bulk_ingest"),
  );

  return requestedJobs.includes("sec_bulk_ingest") &&
    !normalizedJobs.includes("metric_series")
    ? [...normalizedJobs, "metric_series"]
    : normalizedJobs;
}
