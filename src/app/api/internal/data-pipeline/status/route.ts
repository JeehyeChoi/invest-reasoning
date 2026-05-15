// src/app/api/internal/data-pipeline/status/route.ts

import { NextResponse } from "next/server";
import { getDataPipelineRefreshStatus } from "@/backend/workflows/data-pipeline-refresh/dataPipelineRefreshRuntimeState";
import { getDataPipelineRefreshLockState } from "@/backend/workflows/data-pipeline-refresh/dataPipelineRefreshLock";

export async function GET() {
  const status = getDataPipelineRefreshStatus();
  const lockState = getDataPipelineRefreshLockState();

  return NextResponse.json({
    ...status,
    activeRuns: lockState.locks.map((lock, index) => ({
      slot: lock.slot,
      id: lock.id,
      startedAt: lock.startedAt,
      ageMs: lock.ageMs,
      jobs: lock.jobs,
      groups: lock.groups,
    })),
  });
}
