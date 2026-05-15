import { FACTOR_BLUEPRINTS } from "@/backend/config/factors/blueprints";
import type { FactorKey } from "@/shared/factors/factors";
import type { FactorAxisKey } from "@/shared/factors/axes";
import { isSecMetricKey } from "@/shared/sec/metrics";
import { isMarketPriceMetricKey } from "@/shared/factors/marketPriceMetrics";
import { isValuationMetricKey } from "@/shared/factors/valuationMetrics";
import { isMacroLinkedMetricKey } from "@/shared/factors/macroLinkedMetrics";
import { runTickerFactorMetricFeatures } from "@/backend/services/sec/companyFacts/series/feature/runTickerFactorMetricFeatures";
import type { FeatureRunTarget } from "@/backend/services/sec/companyFacts/series/feature/runTickerFactorMetricFeatures";
import type { DataPipelineRefreshJobKey } from "@/shared/data-pipeline/jobs";

type WorkflowProgress = {
  job?: DataPipelineRefreshJobKey;
  message: string;
  current?: number;
  total?: number;
  label?: string;
};

export type RunTickerFactorMetricFeaturesWorkflowInput = {
  tickers: string[];
  tickerCikMap?: Record<string, string | null>;
  axes?: FactorAxisKey[];
  asOfDate?: string;
  progressJob?: DataPipelineRefreshJobKey;
  onProgress?: (progress: WorkflowProgress) => void;
};

export type TickerFactorMetricFeaturesWorkflowResult = {
  warnings: string[];
};

function buildFeatureTargetsFromBlueprints(input: {
  axes?: FactorAxisKey[];
} = {}): FeatureRunTarget[] {
  const targets: FeatureRunTarget[] = [];
  const axisFilter = input.axes ? new Set(input.axes) : null;

  for (const [factor, factorBlueprint] of Object.entries(FACTOR_BLUEPRINTS)) {
    if (!factorBlueprint) continue;

    for (const [axis, axisBlueprint] of Object.entries(factorBlueprint)) {
      if (axisFilter && !axisFilter.has(axis as FactorAxisKey)) continue;

      for (const metricKey of axisBlueprint.metricKeys) {
        const isSupportedMetricTarget =
          isSecMetricKey(metricKey) ||
          (axis === "valuation" && isValuationMetricKey(metricKey)) ||
          (axis === "market_price" && isMarketPriceMetricKey(metricKey)) ||
          (axis === "macro_linked" && isMacroLinkedMetricKey(metricKey));

        if (!isSupportedMetricTarget) {
          continue;
        }

        targets.push({
          factor: factor as FactorKey,
          axis: axis as FactorAxisKey,
          metricKey,
        });
      }
    }
  }

  return targets;
}

export async function runTickerFactorMetricFeaturesWorkflow(
  input: RunTickerFactorMetricFeaturesWorkflowInput,
): Promise<TickerFactorMetricFeaturesWorkflowResult> {
  const result = await runTickerFactorMetricFeatures({
    companies: input.tickers.map((ticker) => ({
      ticker,
      cik: input.tickerCikMap?.[ticker] ?? null,
    })),
    targets: buildFeatureTargetsFromBlueprints({ axes: input.axes }),
    asOfDate: input.asOfDate,
    onProgress: (progress) =>
      input.onProgress?.({
        job: input.progressJob ?? "fundamentals_based_factor_features",
        ...progress,
      }),
  });

  return {
    warnings: result.warnings,
  };
}
