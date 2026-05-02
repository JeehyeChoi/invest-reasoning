let isRunning = false;

export function acquireDataPipelineRefreshLock() {
  if (isRunning) return false;

  isRunning = true;
  return true;
}

export function releaseDataPipelineRefreshLock() {
  isRunning = false;
}
