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
import { runSecCompanyFactsFiscalProfileWorkflow } from "@/backend/workflows/sec-companyfacts-fiscal-profile/runSecCompanyFactsFiscalProfileWorkflow";
import { runSecCompanyFactsMetricSeriesWorkflow } from "@/backend/workflows/sec-companyfacts-metric-series/runSecCompanyFactsMetricSeriesWorkflow";
import { runSecCompanyFactsSeriesValidationWorkflow } from "@/backend/workflows/sec-companyfacts-series-validation/runSecCompanyFactsSeriesValidationWorkflow";
import { runSecCompanyFactsTagSeriesWorkflow } from "@/backend/workflows/sec-companyfacts-tag-series/runSecCompanyFactsTagSeriesWorkflow";
import { runTickerFactorMetricClusteringWorkflow } from "@/backend/workflows/ticker-factor-metric-clustering/runTickerFactorMetricClusteringWorkflow";
import { runTickerFactorMetricSignalsWorkflow } from "@/backend/workflows/ticker-factor-metric-signals/runTickerFactorMetricSignalsWorkflow";
import { runTickerCoreSyncWorkflow } from "@/backend/workflows/ticker-core-sync/runTickerCoreSyncWorkflow";
import { runUniverseSelectionWorkflow } from "@/backend/workflows/universe-selection/runUniverseSelectionWorkflow";
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
    message: progress.message,
  });
}

export async function runDataPipelineRefreshWorkflow(
  input: RunDataPipelineRefreshWorkflowInput = {},
) {
  const requestedJobs = input.jobs ?? DEFAULT_DATA_PIPELINE_REFRESH_JOBS;
  const jobs = new Set<DataPipelineRefreshJobKey>(requestedJobs);
  const companyScope = input.companyScope ?? "all";
  const universeRefreshMode = input.universeRefreshMode ?? "skip";
  const tickerCoreSyncMode = input.tickerCoreSyncMode ?? "skip";

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
        ? `Ticker universe prepared. universes=${universeSelection.universeKeys.join(", ")}, refreshed=${universeSelection.refreshedUniverseKeys.join(", ")}, tickers=${tickers.length}.`
        : `Ticker universe loaded from stored memberships. universes=${universeSelection.universeKeys.join(", ")}, tickers=${tickers.length}.`,
  });

  if (universeSelection.unsupportedRefreshUniverseKeys.length > 0) {
    reportDataPipelineProgress({
      message: `Universe refresh not yet implemented for: ${universeSelection.unsupportedRefreshUniverseKeys.join(", ")}.`,
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
          current: progress.current,
          total: progress.total,
          label: progress.label,
        }),
    });

    reportDataPipelineProgress({
      message: tickerCoreResult.stoppedByRateLimit
        ? `Ticker core sync stopped by provider rate limit. processed=${tickerCoreResult.processedCount}, failed=${tickerCoreResult.failedCount}, candidates=${tickerCoreResult.candidateCount}.`
        : `Ticker core sync completed. processed=${tickerCoreResult.processedCount}, failed=${tickerCoreResult.failedCount}, candidates=${tickerCoreResult.candidateCount}.`,
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

  let bulkChangedCiks = new Set<string>();
  let didRunBulkIngest = false;

  if (jobs.has("sec_bulk_ingest")) {
    didRunBulkIngest = true;
    reportDataPipelineProgress({
      job: "sec_bulk_ingest",
      message: "SEC bulk ingest started.",
    });

    const bulkIngestResult = await runSecBulkIngestWorkflow({ allowedCiks });
    bulkChangedCiks = new Set(bulkIngestResult.changedCiks);

    reportDataPipelineProgress({
      job: "sec_bulk_ingest",
      message: bulkIngestResult.didSkipIngest
        ? `SEC bulk ingest skipped: no company entries changed by file size. checked=${bulkIngestResult.totalCount}, unchanged=${bulkIngestResult.sameSizeSkipCount}.`
        : `SEC bulk ingest completed. changed=${bulkChangedCiks.size}, processed=${bulkIngestResult.processedCount}, failed=${bulkIngestResult.failedCount}.`,
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

  if (companyScope === "bulk_changed") {
    reportDataPipelineProgress({
      message: `Downstream company scope: changed companies from latest SEC bulk ingest (${bulkChangedCiks.size}).`,
    });
  }

  if (jobs.has("fiscal_profile")) {
    await runSecCompanyFactsFiscalProfileWorkflow({
      tickerCikMap: scopedTickerCikMap,
      onProgress: reportDataPipelineProgress,
    });
  }

  if (jobs.has("tag_series")) {
    await runSecCompanyFactsTagSeriesWorkflow({
      tickerCikMap: scopedTickerCikMap,
      onProgress: reportDataPipelineProgress,
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

  if (jobs.has("factor_metric_signals")) {
    reportDataPipelineProgress({
      job: "factor_metric_signals",
      message: "Factor metric signals started.",
    });

    await runTickerFactorMetricSignalsWorkflow({
      tickers: scopedTickers,
      tickerCikMap: scopedTickerCikMap,
    });

    reportDataPipelineProgress({
      job: "factor_metric_signals",
      message: "Factor metric signals completed.",
    });
  }

  if (jobs.has("factor_metric_clustering")) {
    reportDataPipelineProgress({
      job: "factor_metric_clustering",
      message: "Factor metric clustering started.",
    });

    const result = await runTickerFactorMetricClusteringWorkflow();

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
