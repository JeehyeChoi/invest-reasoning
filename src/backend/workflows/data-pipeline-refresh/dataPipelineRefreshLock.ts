import type { DataPipelineRefreshJobKey } from "@/shared/data-pipeline/jobs";

const MAX_LOCK_AGE_MS = 6 * 60 * 60 * 1000;
const MAX_ACTIVE_LOCKS = 2;

type DataPipelineRefreshLockGroup =
  | "universe_memberships"
  | "ticker_core"
  | "macro_fred"
  | "daily_price_history"
  | "sec_companyfacts"
  | "derived_metrics"
  | "factor_features"
  | "factor_outputs";

type DataPipelineRefreshLock = {
  id: string;
  slot: number;
  acquiredAt: number;
  startedAt: string;
  jobs: DataPipelineRefreshJobKey[];
  groups: DataPipelineRefreshLockGroup[];
};

type DataPipelineRefreshLockGlobal = typeof globalThis & {
  __geoPortfolioDataPipelineRefreshLocks?: DataPipelineRefreshLock[];
};

type AcquireDataPipelineRefreshLockResult =
  | {
      acquired: true;
      lock: DataPipelineRefreshLock;
      activeCount: number;
    }
  | {
      acquired: false;
      reason: "capacity" | "conflict";
      activeCount: number;
      conflictingGroups?: DataPipelineRefreshLockGroup[];
      startedAt: string | null;
      ageMs: number;
    };

const runtimeGlobal = globalThis as DataPipelineRefreshLockGlobal;

function getLocks(): DataPipelineRefreshLock[] {
  runtimeGlobal.__geoPortfolioDataPipelineRefreshLocks ??= [];
  return runtimeGlobal.__geoPortfolioDataPipelineRefreshLocks;
}

function setLocks(next: DataPipelineRefreshLock[]) {
  runtimeGlobal.__geoPortfolioDataPipelineRefreshLocks = next;
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

function pruneStaleLocks() {
  const freshLocks = getLocks().filter(isLockFresh);
  setLocks(freshLocks);
  return freshLocks;
}

export function acquireDataPipelineRefreshLock(input: {
  jobs: DataPipelineRefreshJobKey[];
  targetSlot?: number;
}): AcquireDataPipelineRefreshLockResult {
  const locks = pruneStaleLocks();
  const groups = getLockGroupsForJobs(input.jobs);
  const conflictingGroups = getConflictingGroups(groups, locks);
  const oldestLock = locks[0] ?? null;
  const targetSlot = normalizeTargetSlot(input.targetSlot);
  const occupiedSlots = new Set(locks.map((lock) => lock.slot));
  const selectedSlot =
    targetSlot ?? [1, 2].find((slot) => !occupiedSlots.has(slot)) ?? null;

  if (conflictingGroups.length > 0) {
    return {
      acquired: false,
      reason: "conflict",
      activeCount: locks.length,
      conflictingGroups,
      startedAt: oldestLock?.startedAt ?? null,
      ageMs: oldestLock ? getLockAgeMs(oldestLock) : 0,
    };
  }

  if (locks.length >= MAX_ACTIVE_LOCKS) {
    return {
      acquired: false,
      reason: "capacity",
      activeCount: locks.length,
      startedAt: oldestLock?.startedAt ?? null,
      ageMs: oldestLock ? getLockAgeMs(oldestLock) : 0,
    };
  }

  if (selectedSlot === null || occupiedSlots.has(selectedSlot)) {
    return {
      acquired: false,
      reason: "capacity",
      activeCount: locks.length,
      startedAt: oldestLock?.startedAt ?? null,
      ageMs: oldestLock ? getLockAgeMs(oldestLock) : 0,
    };
  }

  const lock: DataPipelineRefreshLock = {
    id: crypto.randomUUID(),
    slot: selectedSlot,
    acquiredAt: Date.now(),
    startedAt: new Date().toISOString(),
    jobs: input.jobs,
    groups,
  };

  setLocks([...locks, lock]);

  return {
    acquired: true,
    lock,
    activeCount: locks.length + 1,
  };
}

export function releaseDataPipelineRefreshLock(lockId: string) {
  setLocks(getLocks().filter((lock) => lock.id !== lockId));
  return getDataPipelineRefreshLockState();
}

export function getDataPipelineRefreshLockState() {
  const locks = pruneStaleLocks();
  const oldestLock = locks[0] ?? null;

  return locks.length > 0
    ? {
        isRunning: true,
        activeCount: locks.length,
        maxActiveCount: MAX_ACTIVE_LOCKS,
        startedAt: oldestLock?.startedAt ?? null,
        ageMs: oldestLock ? getLockAgeMs(oldestLock) : 0,
        isStale: locks.some(isLockStale),
        locks: locks
          .map((lock) => ({
          id: lock.id,
          slot: lock.slot,
          startedAt: lock.startedAt,
          ageMs: getLockAgeMs(lock),
          jobs: lock.jobs,
          groups: lock.groups,
          }))
          .sort((a, b) => a.slot - b.slot),
      }
    : {
        isRunning: false,
        activeCount: 0,
        maxActiveCount: MAX_ACTIVE_LOCKS,
        startedAt: null,
        ageMs: 0,
        isStale: false,
        locks: [],
      };
}

function getConflictingGroups(
  groups: DataPipelineRefreshLockGroup[],
  locks: DataPipelineRefreshLock[],
): DataPipelineRefreshLockGroup[] {
  const activeGroups = new Set(locks.flatMap((lock) => lock.groups));

  return groups.filter((group) => activeGroups.has(group));
}

function getLockGroupsForJobs(
  jobs: DataPipelineRefreshJobKey[],
): DataPipelineRefreshLockGroup[] {
  const groups = new Set<DataPipelineRefreshLockGroup>();

  for (const job of jobs) {
    for (const group of getLockGroupsForJob(job)) {
      groups.add(group);
    }
  }

  return [...groups];
}

function getLockGroupsForJob(
  job: DataPipelineRefreshJobKey,
): DataPipelineRefreshLockGroup[] {
  switch (job) {
    case "universe_memberships_sync":
      return ["universe_memberships"];
    case "ticker_core_sync":
      return ["ticker_core"];
    case "macro_fred_series_sync":
      return ["macro_fred"];
    case "ticker_daily_price_history_sync":
      return ["daily_price_history"];
    case "sec_bulk_ingest":
    case "metric_series":
    case "sec_metric_series_experiment":
    case "series_validation":
    case "sec_metric_series_enriched":
      return ["sec_companyfacts"];
    case "derived_metric_series":
      return [
        "derived_metrics",
        "daily_price_history",
        "sec_companyfacts",
        "macro_fred",
      ];
    case "ticker_implied_financial_expectations":
      return ["derived_metrics"];
    case "fundamentals_based_factor_features":
      return ["factor_features", "sec_companyfacts"];
    case "valuation_factor_features":
      return ["factor_features", "derived_metrics"];
    case "market_price_factor_features":
    case "etf_exposure_factor_features":
      return ["factor_features", "daily_price_history"];
    case "macro_linked_factor_features":
      return ["factor_features", "sec_companyfacts", "macro_fred"];
    case "factor_signals":
    case "signal_percolation_timeline":
      return ["factor_outputs", "factor_features"];
  }
}

function normalizeTargetSlot(value: number | undefined): number | undefined {
  if (value === 1 || value === 2) return value;
  return undefined;
}
