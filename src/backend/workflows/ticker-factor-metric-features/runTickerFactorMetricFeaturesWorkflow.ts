import { FACTOR_BLUEPRINTS } from "@/backend/config/factors/blueprints";
import type { FactorKey } from "@/shared/factors/factors";
import type { FactorAxisKey } from "@/shared/factors/axes";
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
  onProgress?: (progress: WorkflowProgress) => void;
};

export type TickerFactorMetricFeaturesWorkflowResult = {
  warnings: string[];
};

function buildFeatureTargetsFromBlueprints(): FeatureRunTarget[] {
  const targets: FeatureRunTarget[] = [];

  for (const [factor, factorBlueprint] of Object.entries(FACTOR_BLUEPRINTS)) {
    if (!factorBlueprint) continue;

    for (const [axis, axisBlueprint] of Object.entries(factorBlueprint)) {
      for (const metricKey of axisBlueprint.metricKeys) {
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
    targets: buildFeatureTargetsFromBlueprints(),
    rebuildComparisons: true,
    onProgress: (progress) =>
      input.onProgress?.({
        job: "factor_metric_features",
        ...progress,
      }),
  });

  return {
    warnings: result.warnings,
  };
}
