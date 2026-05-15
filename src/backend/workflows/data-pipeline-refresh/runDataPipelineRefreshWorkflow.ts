// src/backend/workflows/data-pipeline-refresh/runDataPipelineRefreshWorkflow.ts
import {
  DATA_PIPELINE_REFRESH_JOB_KEYS,
  DATA_PIPELINE_REFRESH_JOB_LABELS,
  type DataPipelineCompanyScope,
  type DataPipelineRefreshJobKey,
  type DataPipelineRebuildMode,
  type DataPipelineTickerCoreSyncMode,
  type DataPipelineUniverseRefreshMode,
} from "@/shared/data-pipeline/jobs";
import type { SignalTimelineAxisScope } from "@/shared/market/signalCombinationTimeline";
import type { UniverseKey } from "@/shared/universe/universes";

import { db } from "@/backend/config/db";
import { getTickerCikMap } from "@/backend/services/tickers/getTickerCikMap";
import { runSecBulkIngestWorkflow } from "@/backend/workflows/sec-bulk-ingest/runSecBulkIngestWorkflow";
import { runSecCompanyFactsMetricSeriesEnrichedWorkflow } from "@/backend/workflows/sec-companyfacts-metric-series-enriched/runSecCompanyFactsMetricSeriesEnrichedWorkflow";
import { runSecCompanyFactsMetricSeriesWorkflow } from "@/backend/workflows/sec-companyfacts-metric-series/runSecCompanyFactsMetricSeriesWorkflow";
import { runSecCompanyFactsMetricSeriesExperimentWorkflow } from "@/backend/workflows/sec-companyfacts-metric-series-experiment/runSecCompanyFactsMetricSeriesExperimentWorkflow";
import { runSecCompanyFactsSeriesValidationWorkflow } from "@/backend/workflows/sec-companyfacts-series-validation/runSecCompanyFactsSeriesValidationWorkflow";
import { runTickerFactorSignalsWorkflow } from "@/backend/workflows/ticker-factor-signals/runTickerFactorSignalsWorkflow";
import { runTickerSignalPercolationTimelineWorkflow } from "@/backend/workflows/ticker-signal-percolation-timeline/runTickerSignalPercolationTimelineWorkflow";
import {
  countMissingOrStaleTickerCoreSyncCandidates,
  runTickerCoreSyncWorkflow,
} from "@/backend/workflows/ticker-core-sync/runTickerCoreSyncWorkflow";
import { runUniverseSelectionWorkflow } from "@/backend/workflows/universe-selection/runUniverseSelectionWorkflow";
import { runMacroFredSeriesSyncWorkflow } from "@/backend/workflows/macro-fred-series/runMacroFredSeriesSyncWorkflow";
import { runTickerDailyPriceHistorySyncWorkflow } from "@/backend/workflows/ticker-daily-prices/runTickerDailyPriceHistorySyncWorkflow";
import { runTickerMarketPriceFactorFeaturesWorkflow } from "@/backend/workflows/ticker-market-price-factor-features/runTickerMarketPriceFactorFeaturesWorkflow";
import { runTickerEtfExposureFactorFeaturesWorkflow } from "@/backend/workflows/ticker-etf-exposure-factor-features/runTickerEtfExposureFactorFeaturesWorkflow";
import { runTickerMacroLinkedFactorFeaturesWorkflow } from "@/backend/workflows/ticker-macro-linked-factor-features/runTickerMacroLinkedFactorFeaturesWorkflow";
import { runTickerFundamentalsFactorFeaturesWorkflow } from "@/backend/workflows/ticker-fundamentals-factor-features/runTickerFundamentalsFactorFeaturesWorkflow";
import { runTickerValuationFactorFeaturesWorkflow } from "@/backend/workflows/ticker-valuation-factor-features/runTickerValuationFactorFeaturesWorkflow";
import { runTickerDerivedMetricSeriesWorkflow } from "@/backend/workflows/ticker-derived-metric-series/runTickerDerivedMetricSeriesWorkflow";
import { runTickerImpliedFinancialExpectationsWorkflow } from "@/backend/workflows/ticker-implied-financial-expectations/runTickerImpliedFinancialExpectationsWorkflow";
import type {
  DailyPriceAdjustmentPolicy,
  DailyPriceProviderKey,
} from "@/backend/services/market/history/types";
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
  tickerCoreTickers?: string[];
  secTagCandidateDiscovery?: boolean;
  secMetricSeriesExperimentMaxCiks?: number;
  secMetricSeriesExperimentClearBeforeRun?: boolean;
  tickerDailyPriceProvider?: DailyPriceProviderKey;
  tickerDailyPriceAdjustmentPolicy?: DailyPriceAdjustmentPolicy;
  tickerDailyPriceEndDate?: string;
  tickerDailyPriceYearsBack?: number;
  tickerDailyPriceMaxTickers?: number;
  tickerDailyPriceMaxRequests?: number;
  tickerDailyPriceTickers?: string[];
  factorFeatureAsOfDate?: string;
  signalPercolationAxisScopes?: SignalTimelineAxisScope[];
  signalPercolationClearBeforeRun?: boolean;
};

const DEFAULT_DATA_PIPELINE_REFRESH_JOBS: DataPipelineRefreshJobKey[] =
  DATA_PIPELINE_REFRESH_JOB_KEYS.filter(
    (job) =>
      job !== "universe_memberships_sync" &&
      job !== "ticker_core_sync" &&
      job !== "ticker_daily_price_history_sync" &&
      job !== "sec_metric_series_experiment",
  );

type WorkflowProgress = {
  job?: DataPipelineRefreshJobKey;
  message: string;
  level?: "info" | "warning" | "error";
  current?: number;
  total?: number;
  label?: string;
};

type TickerDailyPriceHistorySyncSummary = {
  provider: DailyPriceProviderKey;
  adjustmentPolicy: DailyPriceAdjustmentPolicy;
  targetStartDate: string;
  targetEndDate: string;
  processedCount: number;
  processedTickers: string[];
  failedCount: number;
  rowCount: number;
  requestCount: number;
  stoppedByRequestBudget: boolean;
  stoppedByProviderLimit: boolean;
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

function getTickerDailyPriceHistorySyncSummaryMessage(
  result: TickerDailyPriceHistorySyncSummary,
): string {
  const suffix = `provider=${result.provider}, adjustment=${result.adjustmentPolicy}, targetStart=${result.targetStartDate}, targetEnd=${result.targetEndDate}, processed=${result.processedCount}, failed=${result.failedCount}, rows=${result.rowCount}, requests=${result.requestCount}.`;

  if (result.stoppedByProviderLimit) {
    return `Ticker daily price history sync stopped by provider daily limit. ${suffix}`;
  }

  if (result.stoppedByRequestBudget) {
    return `Ticker daily price history sync stopped by request budget. ${suffix}`;
  }

  return `Ticker daily price history sync completed. ${suffix}`;
}

function getJobLabel(job: DataPipelineRefreshJobKey): string {
  return DATA_PIPELINE_REFRESH_JOB_LABELS[job] ?? job;
}

export async function runDataPipelineRefreshWorkflow(
  input: RunDataPipelineRefreshWorkflowInput = {},
) {
  const requestedJobs = input.jobs ?? DEFAULT_DATA_PIPELINE_REFRESH_JOBS;
  const normalizedJobs = requestedJobs.filter(
    (job) =>
      job !== "metric_series" || requestedJobs.includes("sec_bulk_ingest"),
  );
  const jobs = new Set<DataPipelineRefreshJobKey>(
    requestedJobs.includes("sec_bulk_ingest") &&
    !normalizedJobs.includes("metric_series")
      ? [...normalizedJobs, "metric_series"]
      : normalizedJobs,
  );
  const companyScope: DataPipelineCompanyScope =
    input.companyScope === "bulk_changed" ? "bulk_changed" : "all";
  const shouldForceReadAllSecCompanyFacts = companyScope === "all";
  const universeRefreshMode =
    jobs.has("universe_memberships_sync") ||
    input.universeRefreshMode === "selected"
      ? "selected"
      : "skip";
  const tickerCoreSyncMode =
    jobs.has("ticker_core_sync") ||
    input.tickerCoreSyncMode === "missing_or_stale"
      ? "missing_or_stale"
      : "skip";
  const needsSecCompanyPipeline =
    jobs.has("sec_bulk_ingest") ||
    jobs.has("metric_series") ||
    jobs.has("sec_metric_series_experiment") ||
    jobs.has("series_validation") ||
    jobs.has("sec_metric_series_enriched") ||
    jobs.has("fundamentals_based_factor_features") ||
    jobs.has("macro_linked_factor_features") ||
    jobs.has("valuation_factor_features");
  const needsMarketPriceFeatures = jobs.has("market_price_factor_features");
  const needsEtfExposureFeatures = jobs.has("etf_exposure_factor_features");
  const needsFeatureOutputs =
    jobs.has("fundamentals_based_factor_features") ||
    jobs.has("macro_linked_factor_features") ||
    jobs.has("valuation_factor_features") ||
    needsMarketPriceFeatures ||
    needsEtfExposureFeatures;
  const needsDerivedMetricSeries = jobs.has("derived_metric_series");
  const needsTickerImpliedFinancialExpectations = jobs.has(
    "ticker_implied_financial_expectations",
  );
  const needsGlobalFeatureOutputs =
    jobs.has("factor_signals") || jobs.has("signal_percolation_timeline");
  let dailyPriceProcessedTickers: string[] | undefined;
  let priceDrivenChangedTickers: string[] | undefined;
  let derivedMetricTargetTickers: string[] | undefined;

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
          level: progress.level,
          current: progress.current,
          total: progress.total,
          label: progress.label,
        }),
    });

    reportDataPipelineProgress({
      job: "macro_fred_series_sync",
      message:
        result.failedSeriesResults.length > 0
          ? `Macro FRED series sync completed with warnings. synced=${result.seriesResults.length}, failed=${result.failedSeriesResults.length}, rows=${result.rowCount}.`
          : `Macro FRED series sync completed. series=${result.seriesResults.length}, rows=${result.rowCount}.`,
      level: result.failedSeriesResults.length > 0 ? "warning" : "info",
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
        ? `Ticker universe prepared. universes=${universeSelection.universeKeys.join(", ")}, refreshed=${universeSelection.refreshedUniverseKeys.join(", ")}, activeTickers=${tickers.length}.`
        : `Ticker universe loaded from stored memberships. universes=${universeSelection.universeKeys.join(", ")}, activeTickers=${tickers.length}.`,
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
      tickers: input.tickerCoreTickers,
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
  } else if (needsSecCompanyPipeline) {
    const tickerCoreCandidates =
      await countMissingOrStaleTickerCoreSyncCandidates({
        universeKeys: universeSelection.universeKeys,
      });

    reportDataPipelineProgress({
      message: `Using stored company profiles. FMP ticker core sync skipped. staleAfterDays=${tickerCoreCandidates.staleAfterDays}, missingOrStaleCandidates=${tickerCoreCandidates.candidateCount}.`,
    });
  }

  if (jobs.has("ticker_daily_price_history_sync")) {
    reportDataPipelineProgress({
      job: "ticker_daily_price_history_sync",
      message: "Ticker daily price history sync started.",
    });

    const result = await runTickerDailyPriceHistorySyncWorkflow({
      universeKeys: universeSelection.universeKeys,
      provider: input.tickerDailyPriceProvider,
      adjustmentPolicy: input.tickerDailyPriceAdjustmentPolicy,
      endDate: input.tickerDailyPriceEndDate,
      tickers: input.tickerDailyPriceTickers,
      yearsBack: input.tickerDailyPriceYearsBack,
      maxTickers: input.tickerDailyPriceMaxTickers,
      maxRequests: input.tickerDailyPriceMaxRequests,
      onProgress: (progress) =>
        reportDataPipelineProgress({
          job: "ticker_daily_price_history_sync",
          message: progress.message,
          level: progress.level,
          current: progress.current,
          total: progress.total,
          label: progress.label,
        }),
    });

    reportDataPipelineProgress({
      job: "ticker_daily_price_history_sync",
      message: getTickerDailyPriceHistorySyncSummaryMessage(result),
    });
    dailyPriceProcessedTickers = result.processedTickers;
  }

  if (
    !input.tickerDailyPriceTickers?.length &&
    dailyPriceProcessedTickers === undefined &&
    (needsDerivedMetricSeries || needsMarketPriceFeatures || needsEtfExposureFeatures)
  ) {
    priceDrivenChangedTickers = await loadPriceDrivenChangedTickers({
      tickers,
      provider: input.tickerDailyPriceProvider,
      adjustmentPolicy: input.tickerDailyPriceAdjustmentPolicy,
      includeDerived: needsDerivedMetricSeries,
      includeMarketPriceFeatures: needsMarketPriceFeatures,
      includeEtfExposureFeatures: needsEtfExposureFeatures,
    });

    reportDataPipelineProgress({
      message: `Price-driven changed targets resolved from sync state. tickers=${priceDrivenChangedTickers.length}.`,
      current: 0,
      total: priceDrivenChangedTickers.length,
    });
  }

  if (
    !needsSecCompanyPipeline &&
    !needsDerivedMetricSeries &&
    !needsTickerImpliedFinancialExpectations &&
    !needsFeatureOutputs &&
    !needsGlobalFeatureOutputs
  ) {
    reportDataPipelineProgress({
      message:
        "Selected jobs completed. SEC Companyfacts / Series jobs were not selected, so CIK resolution and SEC ingest were skipped.",
    });
    return;
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
  const buildMetricSeriesDuringBulkIngest =
    jobs.has("sec_bulk_ingest") && jobs.has("metric_series");
  const validateMetricSeriesDuringBulkIngest =
    buildMetricSeriesDuringBulkIngest && jobs.has("series_validation");

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
      buildMetricSeriesBeforeTagCleanup: buildMetricSeriesDuringBulkIngest,
      validateMetricSeriesBeforeCleanup: validateMetricSeriesDuringBulkIngest,
      cleanupTagSeriesAfterMetric: buildMetricSeriesDuringBulkIngest,
      collectTagCandidateStats: input.secTagCandidateDiscovery === true,
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

  if (jobs.has("metric_series") && !buildMetricSeriesDuringBulkIngest) {
    await runSecCompanyFactsMetricSeriesWorkflow({
      tickerCikMap: scopedTickerCikMap,
      rebuild: input.rebuild ?? true,
      rebuildMode: input.rebuildMode ?? "all",
      onProgress: reportDataPipelineProgress,
    });
  }

  if (jobs.has("sec_metric_series_experiment")) {
    await runSecCompanyFactsMetricSeriesExperimentWorkflow({
      tickerCikMap: scopedTickerCikMap,
      maxCiks: input.secMetricSeriesExperimentMaxCiks,
      clearBeforeRun: input.secMetricSeriesExperimentClearBeforeRun,
      onProgress: reportDataPipelineProgress,
    });
  }

  if (jobs.has("series_validation") && !validateMetricSeriesDuringBulkIngest) {
    await runSecCompanyFactsSeriesValidationWorkflow({
      tickerCikMap: scopedTickerCikMap,
      onProgress: reportDataPipelineProgress,
    });
  }

  if (jobs.has("sec_metric_series_enriched")) {
    await runSecCompanyFactsMetricSeriesEnrichedWorkflow({
      tickerCikMap: scopedTickerCikMap,
      rebuildMode: input.rebuildMode ?? "all",
      onProgress: reportDataPipelineProgress,
    });
  }

  if (needsDerivedMetricSeries) {
    derivedMetricTargetTickers = resolveDerivedMetricTickerFilter({
      companyScope,
      scopedTickers,
      allTickers: tickers,
      explicitPriceTickers: input.tickerDailyPriceTickers,
      processedPriceTickers: dailyPriceProcessedTickers,
      statePriceTickers: priceDrivenChangedTickers,
      needsSecCompanyPipeline,
    });

    reportDataPipelineProgress({
      job: "derived_metric_series",
      message: `Derived metric series started. targetTickers=${derivedMetricTargetTickers.length}.`,
      current: 0,
      total: derivedMetricTargetTickers.length,
    });

    const result = await runTickerDerivedMetricSeriesWorkflow({
      tickers: derivedMetricTargetTickers,
      tickerCikMap: scopedTickerCikMap,
      provider: input.tickerDailyPriceProvider,
      adjustmentPolicy: input.tickerDailyPriceAdjustmentPolicy,
      asOfDate: input.factorFeatureAsOfDate,
      onProgress: (progress) =>
        reportDataPipelineProgress({
          job: "derived_metric_series",
          message: progress.message,
          current: progress.current,
          total: progress.total,
          label: progress.label,
        }),
    });

    reportDataPipelineProgress({
      job: "derived_metric_series",
      message: `Derived metric series completed. tickers=${result.tickerCount}, derivedRows=${result.derivedRowCount}, asOf=${result.asOfDate ?? "-"}.`,
    });
  }

  if (needsTickerImpliedFinancialExpectations) {
    reportDataPipelineProgress({
      job: "ticker_implied_financial_expectations",
      message: `${getJobLabel("ticker_implied_financial_expectations")} started.`,
    });

    const result = await runTickerImpliedFinancialExpectationsWorkflow({
      tickers: input.tickerDailyPriceTickers?.length
        ? input.tickerDailyPriceTickers
        : scopedTickers,
      provider: input.tickerDailyPriceProvider,
      adjustmentPolicy: input.tickerDailyPriceAdjustmentPolicy,
      asOfDate: input.factorFeatureAsOfDate,
      onProgress: (progress) =>
        reportDataPipelineProgress({
          job: "ticker_implied_financial_expectations",
          message: progress.message,
          current: progress.current,
          total: progress.total,
          label: progress.label,
        }),
    });

    reportDataPipelineProgress({
      job: "ticker_implied_financial_expectations",
      message: `Ticker implied financial expectations completed. tickers=${result.tickerCount}, rows=${result.expectationRowCount}, asOf=${result.asOfDate ?? "-"}.`,
    });
  }

  if (jobs.has("fundamentals_based_factor_features")) {
    reportDataPipelineProgress({
      job: "fundamentals_based_factor_features",
      message: `${getJobLabel("fundamentals_based_factor_features")} started. targetTickers=${scopedTickers.length}.`,
      current: 0,
      total: scopedTickers.length,
    });

    await runTickerFundamentalsFactorFeaturesWorkflow({
      tickers: scopedTickers,
      tickerCikMap: scopedTickerCikMap,
      asOfDate: input.factorFeatureAsOfDate,
      onProgress: reportDataPipelineProgress,
    });

    reportDataPipelineProgress({
      job: "fundamentals_based_factor_features",
      message: `${getJobLabel("fundamentals_based_factor_features")} completed.`,
    });
  }

  if (jobs.has("valuation_factor_features")) {
    const valuationFeatureTargetTickers =
      derivedMetricTargetTickers ??
      resolveDerivedMetricTickerFilter({
        companyScope,
        scopedTickers,
        allTickers: tickers,
        explicitPriceTickers: input.tickerDailyPriceTickers,
        processedPriceTickers: dailyPriceProcessedTickers,
        statePriceTickers: priceDrivenChangedTickers,
        needsSecCompanyPipeline,
      });

    reportDataPipelineProgress({
      job: "valuation_factor_features",
      message: `${getJobLabel("valuation_factor_features")} started. targetTickers=${valuationFeatureTargetTickers.length}.`,
      current: 0,
      total: valuationFeatureTargetTickers.length,
    });

    await runTickerValuationFactorFeaturesWorkflow({
      tickers: valuationFeatureTargetTickers,
      tickerCikMap: scopedTickerCikMap,
      asOfDate: input.factorFeatureAsOfDate,
      onProgress: reportDataPipelineProgress,
    });

    reportDataPipelineProgress({
      job: "valuation_factor_features",
      message: `${getJobLabel("valuation_factor_features")} completed.`,
    });
  }

  if (needsMarketPriceFeatures) {
    const marketPriceFeatureTargetTickers = resolvePriceDrivenTickerFilter({
      allTickers: tickers,
      explicitPriceTickers: input.tickerDailyPriceTickers,
      processedPriceTickers: dailyPriceProcessedTickers,
      statePriceTickers: priceDrivenChangedTickers,
    });

    reportDataPipelineProgress({
      job: "market_price_factor_features",
      message: `${getJobLabel("market_price_factor_features")} started. targetTickers=${marketPriceFeatureTargetTickers.length}.`,
      current: 0,
      total: marketPriceFeatureTargetTickers.length,
    });

    const result = await runTickerMarketPriceFactorFeaturesWorkflow({
      tickers: marketPriceFeatureTargetTickers,
      provider: input.tickerDailyPriceProvider,
      adjustmentPolicy: input.tickerDailyPriceAdjustmentPolicy,
      asOfDate: input.factorFeatureAsOfDate,
      onProgress: (progress) =>
        reportDataPipelineProgress({
          job: "market_price_factor_features",
          message: progress.message,
          level: progress.level,
          current: progress.current,
          total: progress.total,
          label: progress.label,
        }),
    });

    reportDataPipelineProgress({
      job: "market_price_factor_features",
      message: `Market price factor features completed. tickers=${result.tickerCount}, rows=${result.featureRowCount}, asOf=${result.asOfDate ?? "-"}, skippedStale=${result.skippedStaleTickerCount}.`,
    });
  }

  if (needsEtfExposureFeatures) {
    const etfExposureFeatureTargetTickers = resolvePriceDrivenTickerFilter({
      allTickers: tickers,
      explicitPriceTickers: input.tickerDailyPriceTickers,
      processedPriceTickers: dailyPriceProcessedTickers,
      statePriceTickers: priceDrivenChangedTickers,
    });

    reportDataPipelineProgress({
      job: "etf_exposure_factor_features",
      message: `${getJobLabel("etf_exposure_factor_features")} started. targetTickers=${etfExposureFeatureTargetTickers.length}.`,
      current: 0,
      total: etfExposureFeatureTargetTickers.length,
    });

    const result = await runTickerEtfExposureFactorFeaturesWorkflow({
      tickers: etfExposureFeatureTargetTickers,
      provider: input.tickerDailyPriceProvider,
      adjustmentPolicy: input.tickerDailyPriceAdjustmentPolicy,
      asOfDate: input.factorFeatureAsOfDate,
      onProgress: (progress) =>
        reportDataPipelineProgress({
          job: "etf_exposure_factor_features",
          message: progress.message,
          current: progress.current,
          total: progress.total,
          label: progress.label,
        }),
    });

    reportDataPipelineProgress({
      job: "etf_exposure_factor_features",
      message: `ETF exposure factor features completed. tickers=${result.tickerCount}, rows=${result.featureRowCount}, asOf=${result.asOfDate ?? "-"}, skippedStale=${result.skippedStaleTickerCount}.`,
    });
  }

  if (jobs.has("macro_linked_factor_features")) {
    reportDataPipelineProgress({
      job: "macro_linked_factor_features",
      message: `${getJobLabel("macro_linked_factor_features")} started. targetTickers=${scopedTickers.length}.`,
      current: 0,
      total: scopedTickers.length,
    });

    await runTickerMacroLinkedFactorFeaturesWorkflow({
      tickers: scopedTickers,
      tickerCikMap: scopedTickerCikMap,
      asOfDate: input.factorFeatureAsOfDate,
      onProgress: reportDataPipelineProgress,
    });

    reportDataPipelineProgress({
      job: "macro_linked_factor_features",
      message: `${getJobLabel("macro_linked_factor_features")} completed.`,
    });
  }

  if (needsFeatureOutputs) {
    const completedFeatureJobLabels = [
      jobs.has("fundamentals_based_factor_features")
        ? getJobLabel("fundamentals_based_factor_features")
        : null,
      jobs.has("valuation_factor_features")
        ? getJobLabel("valuation_factor_features")
        : null,
      needsMarketPriceFeatures ? getJobLabel("market_price_factor_features") : null,
      needsEtfExposureFeatures ? getJobLabel("etf_exposure_factor_features") : null,
      jobs.has("macro_linked_factor_features")
        ? getJobLabel("macro_linked_factor_features")
        : null,
    ].filter((label): label is string => label !== null);

    reportDataPipelineProgress({
      message: `Feature jobs completed sequentially. jobs=${completedFeatureJobLabels.join(", ")}.`,
    });
  }

  if (jobs.has("factor_signals")) {
    reportDataPipelineProgress({
      job: "factor_signals",
      message: "Factor signals started.",
    });

    const factorSignalTickers = resolveFactorSignalTickerFilter({
      companyScope,
      scopedTickers,
      allTickers: tickers,
      explicitPriceTickers: input.tickerDailyPriceTickers,
      processedPriceTickers: dailyPriceProcessedTickers,
      statePriceTickers: priceDrivenChangedTickers,
      needsCompanyFeatureOutputs:
        jobs.has("fundamentals_based_factor_features") ||
        jobs.has("macro_linked_factor_features") ||
        jobs.has("valuation_factor_features"),
      needsMarketPriceFeatures,
      needsEtfExposureFeatures,
    });
    const factorSignalsChangedOnly =
      factorSignalTickers === undefined &&
      (companyScope === "bulk_changed" ||
        jobs.has("ticker_daily_price_history_sync"));

    reportDataPipelineProgress({
      job: "factor_signals",
      message: `Factor signals target scope resolved. tickers=${factorSignalTickers?.length ?? (factorSignalsChangedOnly ? "feature-changed" : "all")}.`,
      current: 0,
      total: factorSignalTickers?.length,
    });

    const result = await runTickerFactorSignalsWorkflow({
      asOfDate: input.factorFeatureAsOfDate,
      tickers: factorSignalTickers,
      changedOnly: factorSignalsChangedOnly,
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
      message: `Factor signals completed. scopes=${result.processed}, tickers=${result.tickerCount ?? "all"}.`,
    });
  }

  if (jobs.has("signal_percolation_timeline")) {
    reportDataPipelineProgress({
      job: "signal_percolation_timeline",
      message: "Signal percolation timeline started.",
    });

    const result = await runTickerSignalPercolationTimelineWorkflow({
      axisScopes: input.signalPercolationAxisScopes,
      clearBeforeRun: input.signalPercolationClearBeforeRun,
      onProgress: (progress) =>
        reportDataPipelineProgress({
          job: "signal_percolation_timeline",
          message: progress.message,
          current: progress.current,
          total: progress.total,
          label: progress.label,
        }),
    });

    reportDataPipelineProgress({
      job: "signal_percolation_timeline",
      message: `Signal percolation timeline completed. scopes=${result.axisScopes.length}, snapshots=${result.snapshotCount}, forwardReturnSnapshots=${result.forwardReturnSnapshotCount}, forwardValidationEvents=${result.forwardValidationEventCount}, latest=${result.latestAsOfDate ?? "none"}.`,
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

function resolveFactorSignalTickerFilter(input: {
  companyScope: DataPipelineCompanyScope;
  scopedTickers: string[];
  allTickers: string[];
  explicitPriceTickers?: string[];
  processedPriceTickers?: string[];
  statePriceTickers?: string[];
  needsCompanyFeatureOutputs: boolean;
  needsMarketPriceFeatures: boolean;
  needsEtfExposureFeatures: boolean;
}): string[] | undefined {
  const tickerSets: string[][] = [];

  if (input.companyScope === "all" && input.needsCompanyFeatureOutputs) {
    return undefined;
  }

  if (input.companyScope === "bulk_changed" && input.needsCompanyFeatureOutputs) {
    tickerSets.push(input.scopedTickers);
  }

  if (input.explicitPriceTickers?.length) {
    tickerSets.push(input.explicitPriceTickers);
  } else if (input.processedPriceTickers?.length) {
    tickerSets.push(input.processedPriceTickers);
  } else if (input.statePriceTickers !== undefined) {
    tickerSets.push(input.statePriceTickers);
  } else if (
    input.companyScope === "bulk_changed" &&
    (input.needsMarketPriceFeatures || input.needsEtfExposureFeatures)
  ) {
    tickerSets.push(input.allTickers);
  }

  if (tickerSets.length === 0) {
    return undefined;
  }

  return [...new Set(tickerSets.flat().map((ticker) => ticker.toUpperCase()))].sort();
}

function resolveDerivedMetricTickerFilter(input: {
  companyScope: DataPipelineCompanyScope;
  scopedTickers: string[];
  allTickers: string[];
  explicitPriceTickers?: string[];
  processedPriceTickers?: string[];
  statePriceTickers?: string[];
  needsSecCompanyPipeline: boolean;
}): string[] {
  if (input.companyScope === "all" && input.needsSecCompanyPipeline) {
    return input.allTickers;
  }

  const tickerSets: string[][] = [];

  if (input.companyScope === "bulk_changed") {
    tickerSets.push(input.scopedTickers);
  }

  if (input.explicitPriceTickers?.length) {
    tickerSets.push(input.explicitPriceTickers);
  } else if (input.processedPriceTickers?.length) {
    tickerSets.push(input.processedPriceTickers);
  } else if (input.statePriceTickers !== undefined) {
    tickerSets.push(input.statePriceTickers);
  }

  if (tickerSets.length === 0) {
    return input.scopedTickers;
  }

  return [...new Set(tickerSets.flat().map((ticker) => ticker.toUpperCase()))].sort();
}

function resolvePriceDrivenTickerFilter(input: {
  allTickers: string[];
  explicitPriceTickers?: string[];
  processedPriceTickers?: string[];
  statePriceTickers?: string[];
}): string[] {
  if (input.explicitPriceTickers?.length) {
    return [...new Set(input.explicitPriceTickers.map((ticker) => ticker.toUpperCase()))].sort();
  }

  if (input.processedPriceTickers?.length) {
    return [...new Set(input.processedPriceTickers.map((ticker) => ticker.toUpperCase()))].sort();
  }

  if (input.statePriceTickers !== undefined) {
    return [...new Set(input.statePriceTickers.map((ticker) => ticker.toUpperCase()))].sort();
  }

  return input.allTickers;
}

async function loadPriceDrivenChangedTickers(input: {
  tickers: string[];
  provider?: DailyPriceProviderKey;
  adjustmentPolicy?: DailyPriceAdjustmentPolicy;
  includeDerived: boolean;
  includeMarketPriceFeatures: boolean;
  includeEtfExposureFeatures: boolean;
}): Promise<string[]> {
  if (input.tickers.length === 0) return [];

  const result = await db.query<{ ticker: string }>(
    `
    WITH price_state AS (
      SELECT
        ticker,
        MAX(updated_at) AS last_price_updated_at
      FROM public.ticker_daily_price_sync_state
      WHERE ticker = ANY($1::text[])
        AND provider = $2
        AND adjustment_policy = $3
        AND status IN ('completed', 'partial')
      GROUP BY ticker
    ),
    derived_state AS (
      SELECT
        ticker,
        MAX(updated_at) AS last_output_updated_at
      FROM public.ticker_derived_metric_series
      WHERE ticker = ANY($1::text[])
      GROUP BY ticker
    ),
    market_price_feature_state AS (
      SELECT
        ticker,
        MAX(updated_at) AS last_output_updated_at
      FROM public.ticker_factor_metric_features
      WHERE ticker = ANY($1::text[])
        AND axis = 'market_price'
      GROUP BY ticker
    ),
    etf_exposure_feature_state AS (
      SELECT
        ticker,
        MAX(updated_at) AS last_output_updated_at
      FROM public.ticker_factor_metric_features
      WHERE ticker = ANY($1::text[])
        AND axis = 'etf_exposure'
      GROUP BY ticker
    )
    SELECT price_state.ticker
    FROM price_state
    LEFT JOIN derived_state
      ON derived_state.ticker = price_state.ticker
    LEFT JOIN market_price_feature_state
      ON market_price_feature_state.ticker = price_state.ticker
    LEFT JOIN etf_exposure_feature_state
      ON etf_exposure_feature_state.ticker = price_state.ticker
    WHERE (
        $4::boolean
        AND (
          derived_state.last_output_updated_at IS NULL
          OR price_state.last_price_updated_at > derived_state.last_output_updated_at
        )
      )
      OR (
        $5::boolean
        AND (
          market_price_feature_state.last_output_updated_at IS NULL
          OR price_state.last_price_updated_at > market_price_feature_state.last_output_updated_at
        )
      )
      OR (
        $6::boolean
        AND (
          etf_exposure_feature_state.last_output_updated_at IS NULL
          OR price_state.last_price_updated_at > etf_exposure_feature_state.last_output_updated_at
        )
      )
    ORDER BY price_state.ticker
    `,
    [
      uniqueUppercaseTickers(input.tickers),
      input.provider ?? "twelve_data",
      input.adjustmentPolicy ?? "splits",
      input.includeDerived,
      input.includeMarketPriceFeatures,
      input.includeEtfExposureFeatures,
    ],
  );

  return uniqueUppercaseTickers(result.rows.map((row) => row.ticker));
}

function uniqueUppercaseTickers(tickers: string[]): string[] {
  return [...new Set(tickers.map((ticker) => ticker.toUpperCase()))].sort();
}
