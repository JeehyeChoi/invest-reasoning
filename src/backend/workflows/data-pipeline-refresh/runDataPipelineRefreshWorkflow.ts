// src/backend/workflows/data-pipeline-refresh/runDataPipelineRefreshWorkflow.ts
import {
  DATA_PIPELINE_REFRESH_JOB_KEYS,
  type DataPipelineCompanyScope,
  type DataPipelineRefreshJobKey,
  type DataPipelineRebuildMode,
  type DataPipelineTickerCoreSyncMode,
  type DataPipelineUniverseRefreshMode,
} from "@/shared/data-pipeline/jobs";
import type { UniverseKey } from "@/shared/universe/universes";

import { db } from "@/backend/config/db";
import { getTickerCikMap } from "@/backend/services/tickers/getTickerCikMap";
import { runSecBulkIngestWorkflow } from "@/backend/workflows/sec-bulk-ingest/runSecBulkIngestWorkflow";
import { runSecCompanyFactsMetricSeriesWorkflow } from "@/backend/workflows/sec-companyfacts-metric-series/runSecCompanyFactsMetricSeriesWorkflow";
import { runSecCompanyFactsSeriesValidationWorkflow } from "@/backend/workflows/sec-companyfacts-series-validation/runSecCompanyFactsSeriesValidationWorkflow";
import { runTickerFactorMetricClusteringWorkflow } from "@/backend/workflows/ticker-factor-metric-clustering/runTickerFactorMetricClusteringWorkflow";
import { runTickerFactorMetricFeaturesWorkflow } from "@/backend/workflows/ticker-factor-metric-features/runTickerFactorMetricFeaturesWorkflow";
import { runTickerFactorSignalsWorkflow } from "@/backend/workflows/ticker-factor-signals/runTickerFactorSignalsWorkflow";
import {
  countMissingOrStaleTickerCoreSyncCandidates,
  runTickerCoreSyncWorkflow,
} from "@/backend/workflows/ticker-core-sync/runTickerCoreSyncWorkflow";
import { runUniverseSelectionWorkflow } from "@/backend/workflows/universe-selection/runUniverseSelectionWorkflow";
import { runMacroFredSeriesSyncWorkflow } from "@/backend/workflows/macro-fred-series/runMacroFredSeriesSyncWorkflow";
import {
  addDataPipelineRefreshEvent,
  updateDataPipelineRefreshStatus,
} from "./dataPipelineRefreshRuntimeState";

export type RunDataPipelineRefreshWorkflowInput = {
  jobs?: DataPipelineRefreshJobKey[];
  rebuild?: boolean;
  rebuildMode?: DataPipelineRebuildMode;
  companyScope?: DataPipelineCompanyScope;
  universeRefreshMode?: DataPipelineUniverseRefreshMode;
  universeKeys?: UniverseKey[];
  tickerCoreSyncMode?: DataPipelineTickerCoreSyncMode;
  tickerCoreMaxRequests?: number;
};

const DEFAULT_DATA_PIPELINE_REFRESH_JOBS: DataPipelineRefreshJobKey[] =
  [...DATA_PIPELINE_REFRESH_JOB_KEYS];

type WorkflowProgress = {
  job?: DataPipelineRefreshJobKey;
  message: string;
  level?: "info" | "warning" | "error";
  current?: number;
  total?: number;
  label?: string;
};

function reportDataPipelineProgress(progress: WorkflowProgress) {
  updateDataPipelineRefreshStatus({
    status: "running",
    message: progress.message,
    currentJob: progress.job,
    progress:
      progress.current !== undefined ||
      progress.total !== undefined ||
      progress.label !== undefined
        ? {
            current: progress.current,
            total: progress.total,
            label: progress.label,
          }
        : undefined,
  });

  addDataPipelineRefreshEvent({
    job: progress.job,
    level: progress.level,
    message: progress.message,
  });
}

export async function runDataPipelineRefreshWorkflow(
  input: RunDataPipelineRefreshWorkflowInput = {},
) {
  const requestedJobs = input.jobs ?? DEFAULT_DATA_PIPELINE_REFRESH_JOBS;
  const jobs = new Set<DataPipelineRefreshJobKey>(requestedJobs);
  const companyScope: DataPipelineCompanyScope =
    input.companyScope === "bulk_changed" ? "bulk_changed" : "all";
  const shouldForceReadAllSecCompanyFacts = companyScope === "all";
  const universeRefreshMode = input.universeRefreshMode ?? "skip";
  const tickerCoreSyncMode = input.tickerCoreSyncMode ?? "skip";

  if (jobs.has("macro_fred_series_sync")) {
    reportDataPipelineProgress({
      job: "macro_fred_series_sync",
      message: "Macro FRED series sync started.",
    });

    const result = await runMacroFredSeriesSyncWorkflow({
      onProgress: (progress) =>
        reportDataPipelineProgress({
          job: "macro_fred_series_sync",
          message: progress.message,
          current: progress.current,
          total: progress.total,
          label: progress.label,
        }),
    });

    reportDataPipelineProgress({
      job: "macro_fred_series_sync",
      message: `Macro FRED series sync completed. series=${result.seriesResults.length}, rows=${result.rowCount}.`,
    });
  }

  reportDataPipelineProgress({
    message: "Preparing ticker universe.",
  });

  const universeSelection = await runUniverseSelectionWorkflow({
    universeKeys: input.universeKeys,
    refreshMode: universeRefreshMode,
  });
  const tickers = universeSelection.tickers;

  reportDataPipelineProgress({
    message:
      universeSelection.refreshedUniverseKeys.length > 0
        ? `Ticker universe prepared from all stored active memberships. refreshed=${universeSelection.refreshedUniverseKeys.join(", ")}, activeTickers=${tickers.length}.`
        : universeSelection.usedTickerIdentityFallback
          ? `Stored universe memberships are empty; loaded ticker identities instead. activeTickers=${tickers.length}.`
          : `Ticker universe loaded from all stored active memberships. activeTickers=${tickers.length}.`,
  });

  if (universeSelection.unsupportedRefreshUniverseKeys.length > 0) {
    reportDataPipelineProgress({
      message: `Universe sync not yet implemented for: ${universeSelection.unsupportedRefreshUniverseKeys.join(", ")}.`,
    });
  }

  if (tickerCoreSyncMode === "missing_or_stale") {
    reportDataPipelineProgress({
      message: "Syncing missing or stale ticker core data.",
    });

    const tickerCoreResult = await runTickerCoreSyncWorkflow({
      universeKeys: universeSelection.universeKeys,
      maxRequests: input.tickerCoreMaxRequests,
      onProgress: (progress) =>
        reportDataPipelineProgress({
          message: progress.message,
          level: progress.level,
          current: progress.current,
          total: progress.total,
          label: progress.label,
        }),
    });

    reportDataPipelineProgress({
      message: tickerCoreResult.stoppedByRateLimit
        ? `Ticker core sync stopped by provider rate limit. staleAfterDays=${tickerCoreResult.staleAfterDays}, processed=${tickerCoreResult.processedCount}, failed=${tickerCoreResult.failedCount}, candidates=${tickerCoreResult.candidateCount}, requestCap=${tickerCoreResult.maxRequests}.`
        : `Ticker core sync completed. staleAfterDays=${tickerCoreResult.staleAfterDays}, processed=${tickerCoreResult.processedCount}, failed=${tickerCoreResult.failedCount}, candidates=${tickerCoreResult.candidateCount}, requestCap=${tickerCoreResult.maxRequests}.`,
    });
  } else {
    const tickerCoreCandidates =
      await countMissingOrStaleTickerCoreSyncCandidates({
        universeKeys: universeSelection.universeKeys,
      });

    reportDataPipelineProgress({
      message: `Using stored company profiles. FMP ticker core sync skipped. staleAfterDays=${tickerCoreCandidates.staleAfterDays}, missingOrStaleCandidates=${tickerCoreCandidates.candidateCount}.`,
    });
  }

  reportDataPipelineProgress({
    message: "Resolving ticker CIK map.",
    current: 0,
    total: tickers.length,
  });

  const tickerCikMap = await getTickerCikMap(tickers);

  const allowedCiks = new Set(
    Object.values(tickerCikMap).filter((cik): cik is string => Boolean(cik)),
  );

  reportDataPipelineProgress({
    message: `Ticker CIK map resolved. tickers=${tickers.length}, mappedCiks=${allowedCiks.size}, companyScope=${companyScope}.`,
  });

  let bulkChangedCiks = new Set<string>();
  let didRunBulkIngest = false;
  const buildTagSeriesDuringBulkIngest = jobs.has("sec_bulk_ingest");

  if (jobs.has("sec_bulk_ingest")) {
    didRunBulkIngest = true;
    reportDataPipelineProgress({
      job: "sec_bulk_ingest",
      message:
        shouldForceReadAllSecCompanyFacts
          ? "SEC bulk ingest started. Scope=all; every mapped CIK will be reread from the archive before raw cleanup."
          : "SEC bulk ingest started. Scope=bulk_changed; only new or file-size-changed CIKs will be read before raw cleanup.",
    });

    const bulkIngestResult = await runSecBulkIngestWorkflow({
      allowedCiks,
      forceReadAll: shouldForceReadAllSecCompanyFacts,
      tickerByCik: buildTickerByCik(tickerCikMap),
      buildTagSeriesBeforeRawCleanup: buildTagSeriesDuringBulkIngest,
      onProgress: reportDataPipelineProgress,
    });
    bulkChangedCiks = new Set(bulkIngestResult.changedCiks);

    reportDataPipelineProgress({
      job: "sec_bulk_ingest",
      message: bulkIngestResult.didSkipIngest
        ? `[SEC BULK] No company entries changed by file size. Skipping raw ingest. checked=${bulkIngestResult.totalCount}, unchanged=${bulkIngestResult.sameSizeSkipCount}.`
        : `SEC bulk ingest completed. scope=${companyScope}, processedCiks=${bulkChangedCiks.size}, processed=${bulkIngestResult.processedCount}, failed=${bulkIngestResult.failedCount}.`,
    });
  }

  if (companyScope === "bulk_changed" && !didRunBulkIngest) {
    bulkChangedCiks = await loadLatestSecBulkIngestChangedCiks(allowedCiks);
  }

  const scopedTickerCikMap =
    companyScope === "bulk_changed"
      ? filterTickerCikMapByCiks(tickerCikMap, bulkChangedCiks)
      : tickerCikMap;
  const scopedTickers =
    companyScope === "bulk_changed"
      ? tickers.filter((ticker) => {
          const cik = tickerCikMap[ticker];
          return Boolean(cik && bulkChangedCiks.has(cik));
        })
      : tickers;

  const scopedCikCount = new Set(
    Object.values(scopedTickerCikMap).filter((cik): cik is string => Boolean(cik)),
  ).size;

  reportDataPipelineProgress({
    message: `Downstream company targets resolved. scope=${companyScope}, tickers=${scopedTickers.length}, mappedCiks=${scopedCikCount}.`,
  });

  if (companyScope === "bulk_changed") {
    reportDataPipelineProgress({
      message: `Downstream company scope: changed companies from latest SEC bulk ingest (${bulkChangedCiks.size}).`,
    });
  } else {
    reportDataPipelineProgress({
      message:
        "Downstream company scope: all mapped SEC companies. Metric series and validation will run for the full mapped set.",
    });
  }

  if (jobs.has("metric_series")) {
    await runSecCompanyFactsMetricSeriesWorkflow({
      tickerCikMap: scopedTickerCikMap,
      rebuild: input.rebuild ?? true,
      rebuildMode: input.rebuildMode ?? "all",
      onProgress: reportDataPipelineProgress,
    });
  }

  if (jobs.has("series_validation")) {
    await runSecCompanyFactsSeriesValidationWorkflow({
      tickerCikMap: scopedTickerCikMap,
      onProgress: reportDataPipelineProgress,
    });
  }

  if (jobs.has("factor_metric_features")) {
    reportDataPipelineProgress({
      job: "factor_metric_features",
      message: "Factor metric features started.",
    });

    await runTickerFactorMetricFeaturesWorkflow({
      tickers: scopedTickers,
      tickerCikMap: scopedTickerCikMap,
      onProgress: reportDataPipelineProgress,
    });

    reportDataPipelineProgress({
      job: "factor_metric_features",
      message: "Factor metric features completed.",
    });
  }

  if (jobs.has("factor_signals")) {
    reportDataPipelineProgress({
      job: "factor_signals",
      message: "Factor signals started.",
    });

    const result = await runTickerFactorSignalsWorkflow({
      onProgress: (progress) =>
        reportDataPipelineProgress({
          job: "factor_signals",
          message: progress.message,
          current: progress.current,
          total: progress.total,
          label: progress.label,
        }),
    });

    reportDataPipelineProgress({
      job: "factor_signals",
      message: `Factor signals completed. scopes=${result.processed}.`,
    });
  }

  if (jobs.has("factor_metric_clustering")) {
    reportDataPipelineProgress({
      job: "factor_metric_clustering",
      message: "Factor metric clustering started.",
    });

    const result = await runTickerFactorMetricClusteringWorkflow({
      onProgress: (progress) =>
        reportDataPipelineProgress({
          job: "factor_metric_clustering",
          message: progress.message,
          current: progress.current,
          total: progress.total,
          label: progress.label,
        }),
    });

    reportDataPipelineProgress({
      job: "factor_metric_clustering",
      message: `Factor metric clustering completed. run=${result.runId}, tickers=${result.tickerCount}, features=${result.featureCount}, clusters=${result.clusterCount}.`,
    });
  }
}

function filterTickerCikMapByCiks(
  tickerCikMap: Record<string, string | null>,
  allowedCiks: Set<string>,
): Record<string, string | null> {
  return Object.fromEntries(
    Object.entries(tickerCikMap).filter(([, cik]) =>
      Boolean(cik && allowedCiks.has(cik)),
    ),
  );
}

function buildTickerByCik(
  tickerCikMap: Record<string, string | null>,
): Map<string, string> {
  const tickerByCik = new Map<string, string>();

  for (const [ticker, cik] of Object.entries(tickerCikMap)) {
    if (cik && !tickerByCik.has(cik)) {
      tickerByCik.set(cik, ticker);
    }
  }

  return tickerByCik;
}

async function loadLatestSecBulkIngestChangedCiks(
  allowedCiks: Set<string>,
): Promise<Set<string>> {
  const ciks = [...allowedCiks];
  if (ciks.length === 0) return new Set();

  const result = await db.query<{ cik: string }>(
    `
      SELECT cs.cik
      FROM public.sec_companyfact_company_state cs
      CROSS JOIN public.sec_bulk_ingest_state bis
      WHERE bis.dataset = 'companyfacts'
        AND bis.ingest_started_at IS NOT NULL
        AND cs.cik = ANY($1::text[])
        AND cs.last_processed_at >= bis.ingest_started_at
        AND cs.last_processed_at <= COALESCE(bis.ingest_completed_at, NOW())
      ORDER BY cs.cik
    `,
    [ciks],
  );

  return new Set(result.rows.map((row) => row.cik));
}
