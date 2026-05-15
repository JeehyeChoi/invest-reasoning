import { getTickerSignalCombinationTimeline } from "@/backend/services/ticker-signal-combinations/getTickerSignalCombinationTimeline";
import { getTickerSignalCoreForwardReturns } from "@/backend/services/ticker-signal-combinations/getTickerSignalCoreForwardReturns";
import { db } from "@/backend/config/db";
import {
  SIGNAL_TIMELINE_AXIS_SCOPE_OPTIONS,
  type TickerSignalCombinationTimelineSnapshot,
  type SignalTimelineAxisScope,
} from "@/shared/market/signalCombinationTimeline";
import type { TickerSignalCombinationFamilySignalSummary } from "@/shared/market/signalCombinationOverview";

export type TickerSignalPercolationTimelineWorkflowProgress = {
  message: string;
  current?: number;
  total?: number;
  label?: string;
};

export type RunTickerSignalPercolationTimelineWorkflowInput = {
  axisScopes?: SignalTimelineAxisScope[];
  years?: number;
  includeLatest?: boolean;
  refresh?: boolean;
  clearBeforeRun?: boolean;
  onProgress?: (
    progress: TickerSignalPercolationTimelineWorkflowProgress,
  ) => void;
};

export type TickerSignalPercolationTimelineWorkflowScopeResult = {
  axisScope: SignalTimelineAxisScope;
  snapshotCount: number;
  forwardReturnSnapshotCount: number;
  forwardValidationEventCount: number;
  latestAsOfDate: string | null;
  latestTickerCount: number;
  latestGroupCount: number;
  latestSignalDimensionCount: number;
};

export type TickerSignalPercolationTimelineWorkflowResult = {
  axisScopes: TickerSignalPercolationTimelineWorkflowScopeResult[];
  snapshotCount: number;
  forwardReturnSnapshotCount: number;
  forwardValidationEventCount: number;
  latestAsOfDate: string | null;
};

const TOP5_TURNOVER_WATCH_THRESHOLD = 4 / 7;
const TOP5_TURNOVER_REGIME_THRESHOLD = 0.75;

export async function runTickerSignalPercolationTimelineWorkflow(
  input: RunTickerSignalPercolationTimelineWorkflowInput = {},
): Promise<TickerSignalPercolationTimelineWorkflowResult> {
  const axisScopes =
    input.axisScopes && input.axisScopes.length > 0
      ? input.axisScopes
      : SIGNAL_TIMELINE_AXIS_SCOPE_OPTIONS.map((option) => option.key);
  const uniqueAxisScopes = [...new Set(axisScopes)];
  const results: TickerSignalPercolationTimelineWorkflowScopeResult[] = [];

  for (const [index, axisScope] of uniqueAxisScopes.entries()) {
    input.onProgress?.({
      message: `Signal percolation timeline ${index + 1}/${uniqueAxisScopes.length}: ${axisScope}.`,
      current: index + 1,
      total: uniqueAxisScopes.length,
      label: "axis scope",
    });

    if (input.clearBeforeRun) {
      input.onProgress?.({
        message: `Clearing stored signal percolation timeline: ${axisScope}.`,
        current: index + 1,
        total: uniqueAxisScopes.length,
        label: "clear stored timeline",
      });

      const clearResult = await clearStoredSignalPercolationTimeline(axisScope);

      input.onProgress?.({
        message: `Cleared stored signal percolation timeline: ${axisScope}. snapshots=${clearResult.snapshotRows}, forwardReturns=${clearResult.forwardReturnRows}.`,
        current: index + 1,
        total: uniqueAxisScopes.length,
        label: "clear stored timeline",
      });
    }

    const overview = await getTickerSignalCombinationTimeline({
      years: input.years ?? 30,
      includeLatest: input.includeLatest ?? true,
      refresh: input.refresh ?? true,
      axisScope,
    });
    const forwardValidationSnapshots = getForwardValidationCandidateSnapshots(
      overview.snapshots,
    );
    const forwardValidationDates = new Set(
      forwardValidationSnapshots.map((snapshot) => snapshot.asOfDate),
    );
    const forwardReturnSnapshots = overview.snapshots.filter(
      (snapshot) => snapshot.analysis !== null,
    );

    for (const [snapshotIndex, snapshot] of forwardReturnSnapshots.entries()) {
      const eventLabel = forwardValidationDates.has(snapshot.asOfDate)
        ? "event"
        : "baseline";

      input.onProgress?.({
        message: `Signal core forward returns ${snapshotIndex + 1}/${forwardReturnSnapshots.length}: ${axisScope} ${snapshot.asOfDate} (${eventLabel}).`,
        current: snapshotIndex + 1,
        total: forwardReturnSnapshots.length,
        label: "forward returns",
      });

      await getTickerSignalCoreForwardReturns({
        asOfDate: snapshot.asOfDate,
        axisScope,
        useCache: !(input.refresh ?? true),
      });
    }

    const latestSnapshot = overview.snapshots.at(-1) ?? null;

    results.push({
      axisScope,
      snapshotCount: overview.snapshots.length,
      forwardReturnSnapshotCount: forwardReturnSnapshots.length,
      forwardValidationEventCount: forwardValidationSnapshots.length,
      latestAsOfDate: latestSnapshot?.asOfDate ?? null,
      latestTickerCount: latestSnapshot?.tickerCount ?? 0,
      latestGroupCount: latestSnapshot?.groupCount ?? 0,
      latestSignalDimensionCount: latestSnapshot?.signalDimensionCount ?? 0,
    });
  }

  return {
    axisScopes: results,
    snapshotCount: results.reduce(
      (total, result) => total + result.snapshotCount,
      0,
    ),
    forwardReturnSnapshotCount: results.reduce(
      (total, result) => total + result.forwardReturnSnapshotCount,
      0,
    ),
    forwardValidationEventCount: results.reduce(
      (total, result) => total + result.forwardValidationEventCount,
      0,
    ),
    latestAsOfDate:
      results
        .map((result) => result.latestAsOfDate)
        .filter((date): date is string => date !== null)
        .sort()
        .at(-1) ?? null,
  };
}

async function clearStoredSignalPercolationTimeline(
  axisScope: SignalTimelineAxisScope,
) {
  const forwardReturnsResult = await db.query(
    `
      DELETE FROM public.ticker_signal_core_forward_returns
      WHERE axis_scope = $1
        AND lens = 'idfWeightedJaccard'
        AND source_model_key = 'factor_signal'
        AND source_model_version = 'v0'
    `,
    [axisScope],
  );
  const snapshotsResult = await db.query(
    `
      DELETE FROM public.ticker_signal_percolation_timeline_snapshots
      WHERE axis_scope = $1
        AND lens = 'idfWeightedJaccard'
        AND source_model_key = 'factor_signal'
        AND source_model_version = 'v0'
    `,
    [axisScope],
  );

  return {
    snapshotRows: snapshotsResult.rowCount ?? 0,
    forwardReturnRows: forwardReturnsResult.rowCount ?? 0,
  };
}

function getForwardValidationCandidateSnapshots(
  snapshots: TickerSignalCombinationTimelineSnapshot[],
) {
  const snapshotsByDate = new Map(
    snapshots.map((snapshot) => [snapshot.asOfDate, snapshot]),
  );
  const turnoverRows = snapshots.flatMap((snapshot, index) => {
    const previousQuarter = snapshots[index - 1] ?? null;
    const previousYearQuarter =
      snapshotsByDate.get(previousYearSameQuarterDate(snapshot.asOfDate)) ?? null;
    const quarterTurnover = previousQuarter
      ? calculateCoreIdentityTurnover(previousQuarter, snapshot)
      : null;
    const yearTurnover = previousYearQuarter
      ? calculateCoreIdentityTurnover(previousYearQuarter, snapshot)
      : null;

    if (!quarterTurnover && !yearTurnover) return [];

    return [
      {
        snapshot,
        top5YearTurnover: yearTurnover?.top5Turnover ?? null,
        weightedYearTurnover: yearTurnover?.weightedTop10Turnover ?? null,
      },
    ];
  });
  const weightedYearValues = turnoverRows
    .map((row) => row.weightedYearTurnover)
    .filter((value): value is number => value !== null);
  const weightedWatchThreshold = percentile(weightedYearValues, 0.8);
  const weightedRegimeThreshold = percentile(weightedYearValues, 0.9);

  return turnoverRows.flatMap((row) => {
    const top5Year = row.top5YearTurnover ?? 0;
    const weightedYear = row.weightedYearTurnover ?? 0;
    const isRegime =
      top5Year >= TOP5_TURNOVER_REGIME_THRESHOLD ||
      (weightedRegimeThreshold !== null && weightedYear >= weightedRegimeThreshold);
    const isWatch =
      isRegime ||
      top5Year >= TOP5_TURNOVER_WATCH_THRESHOLD ||
      (weightedWatchThreshold !== null && weightedYear >= weightedWatchThreshold);

    return isWatch ? [row.snapshot] : [];
  });
}

function calculateCoreIdentityTurnover(
  leftSnapshot: TickerSignalCombinationTimelineSnapshot,
  rightSnapshot: TickerSignalCombinationTimelineSnapshot,
) {
  const leftSignals = leftSnapshot.baselineSignals ?? [];
  const rightSignals = rightSnapshot.baselineSignals ?? [];
  const top5Turnover = calculateSetTurnover(
    leftSignals.slice(0, 5).map((item) => item.signal.token),
    rightSignals.slice(0, 5).map((item) => item.signal.token),
  );
  const weightedTop10Turnover = calculateWeightedSignalTurnover(
    leftSignals.slice(0, 10),
    rightSignals.slice(0, 10),
  );

  if (top5Turnover === null && weightedTop10Turnover === null) return null;

  return {
    top5Turnover,
    weightedTop10Turnover,
  };
}

function calculateSetTurnover(leftTokens: string[], rightTokens: string[]) {
  const left = new Set(leftTokens);
  const right = new Set(rightTokens);
  const union = new Set([...left, ...right]);

  if (union.size === 0) return null;

  let intersectionSize = 0;
  for (const token of left) {
    if (right.has(token)) intersectionSize += 1;
  }

  return 1 - intersectionSize / union.size;
}

function calculateWeightedSignalTurnover(
  leftSignals: TickerSignalCombinationFamilySignalSummary[],
  rightSignals: TickerSignalCombinationFamilySignalSummary[],
) {
  const leftShares = new Map(
    leftSignals.map((item) => [item.signal.token, item.share]),
  );
  const rightShares = new Map(
    rightSignals.map((item) => [item.signal.token, item.share]),
  );
  const tokens = new Set([...leftShares.keys(), ...rightShares.keys()]);

  if (tokens.size === 0) return null;

  let intersection = 0;
  let union = 0;

  for (const token of tokens) {
    const left = leftShares.get(token) ?? 0;
    const right = rightShares.get(token) ?? 0;

    intersection += Math.min(left, right);
    union += Math.max(left, right);
  }

  return union === 0 ? null : 1 - intersection / union;
}

function previousYearSameQuarterDate(asOfDate: string) {
  const year = Number(asOfDate.slice(0, 4));
  if (!Number.isFinite(year)) return "";

  return `${year - 1}${asOfDate.slice(4, 10)}`;
}

function percentile(values: number[], ratio: number) {
  if (values.length === 0) return null;

  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil(sorted.length * ratio) - 1),
  );

  return sorted[index];
}
