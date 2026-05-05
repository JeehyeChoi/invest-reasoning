const MAX_LOCK_AGE_MS = 6 * 60 * 60 * 1000;

type DataPipelineRefreshLock = {
  acquiredAt: number;
  startedAt: string;
};

type DataPipelineRefreshLockGlobal = typeof globalThis & {
  __geoPortfolioDataPipelineRefreshLock?: DataPipelineRefreshLock | null;
};

const runtimeGlobal = globalThis as DataPipelineRefreshLockGlobal;

function getLock(): DataPipelineRefreshLock | null {
  return runtimeGlobal.__geoPortfolioDataPipelineRefreshLock ?? null;
}

function setLock(next: DataPipelineRefreshLock | null) {
  runtimeGlobal.__geoPortfolioDataPipelineRefreshLock = next;
}

function isLockFresh(lock: DataPipelineRefreshLock): boolean {
  return Date.now() - lock.acquiredAt < MAX_LOCK_AGE_MS;
}

function getLockAgeMs(lock: DataPipelineRefreshLock): number {
  return Date.now() - lock.acquiredAt;
}

function isLockStale(lock: DataPipelineRefreshLock): boolean {
  return !isLockFresh(lock);
}

export function acquireDataPipelineRefreshLock() {
  const lock = getLock();

  if (lock && isLockFresh(lock)) return false;

  setLock({
    acquiredAt: Date.now(),
    startedAt: new Date().toISOString(),
  });
  return true;
}

export function releaseDataPipelineRefreshLock() {
  setLock(null);
}

export function getDataPipelineRefreshLockState() {
  const lock = getLock();

  return lock
    ? {
        isRunning: true,
        startedAt: lock.startedAt,
        ageMs: getLockAgeMs(lock),
        isStale: isLockStale(lock),
      }
    : {
        isRunning: false,
        startedAt: null,
        ageMs: 0,
        isStale: false,
      };
}
