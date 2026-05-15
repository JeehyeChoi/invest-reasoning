import type {
  DataPipelineRefreshJobKey,
  DataPipelineRebuildMode,
  DataPipelineCompanyScope,
  DataPipelineTickerCoreSyncMode,
  DataPipelineUniverseRefreshMode,
} from "@/shared/data-pipeline/jobs";
import type { SignalTimelineAxisScope } from "@/shared/market/signalCombinationTimeline";
import type { UniverseKey } from "@/shared/universe/universes";

export async function triggerDataPipelineRefresh(input: {
  jobs: DataPipelineRefreshJobKey[];
  rebuild: boolean;
  rebuildMode: DataPipelineRebuildMode;
  companyScope: DataPipelineCompanyScope;
  universeRefreshMode: DataPipelineUniverseRefreshMode;
  universeKeys: UniverseKey[];
  tickerCoreSyncMode: DataPipelineTickerCoreSyncMode;
  tickerCoreMaxRequests: number;
  tickerCoreTickers: string[];
  secTagCandidateDiscovery: boolean;
  secMetricSeriesExperimentMaxCiks?: number;
  secMetricSeriesExperimentClearBeforeRun?: boolean;
  tickerDailyPriceEndDate?: string;
  tickerDailyPriceYearsBack: number;
  tickerDailyPriceMaxTickers: number;
  tickerDailyPriceMaxRequests: number;
  tickerDailyPriceTickers: string[];
  factorFeatureAsOfDate?: string;
  signalPercolationAxisScopes?: SignalTimelineAxisScope[];
  signalPercolationClearBeforeRun?: boolean;
  targetSlot?: number;
}): Promise<Response> {
  return fetch("/api/internal/data-pipeline/refresh", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });
}
