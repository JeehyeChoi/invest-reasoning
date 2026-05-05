import type { FactorKey } from "@/shared/factors/factors";
import type { FactorAxisKey } from "@/shared/factors/axes";
import type { SecMetricKey } from "@/shared/sec/metrics";
import { buildTickerFactorMetricFeaturesForCik } from "@/backend/services/sec/companyFacts/series/feature/buildTickerFactorMetricFeaturesForCik";
import { buildTickerFactorMetricFeatureBaselines } from "@/backend/services/sec/companyFacts/series/feature/buildTickerFactorMetricFeatureBaselines";
import { buildTickerFactorMetricFeaturePositions } from "@/backend/services/sec/companyFacts/series/feature/buildTickerFactorMetricFeaturePositions";
import { buildTickerFactorMetricMacroContrasts } from "@/backend/services/sec/companyFacts/series/feature/buildTickerFactorMetricMacroContrasts";

type FeatureRunCompany = {
  ticker: string;
  cik: string | null;
};

export type FeatureRunTarget = {
  factor: FactorKey;
  axis: FactorAxisKey;
  metricKey: SecMetricKey;
};

type FeatureRunInput = {
  companies: FeatureRunCompany[];
  targets: FeatureRunTarget[];
  rebuildComparisons?: boolean;
  onProgress?: (progress: FeatureRunProgress) => void;
};

type FeatureRunResult = {
  processed: number;
  succeeded: number;
  featureCount: number;
  warnings: string[];
};

export type FeatureRunProgress = {
  message: string;
  current?: number;
  total?: number;
  label?: string;
};

function isMissingInterpretationError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as NodeJS.ErrnoException).code === "ENOENT"
  );
}

export async function runTickerFactorMetricFeatures(
  input: FeatureRunInput,
): Promise<FeatureRunResult> {
  const warnings: string[] = [];
  const missingInterpretationKeys = new Set<string>();
  let processed = 0;
  let succeeded = 0;
  let featureCount = 0;
  const totalCompanies = input.companies.length;
  const totalTargets = input.companies.length * input.targets.length;
  let processedCompanies = 0;

  for (const company of input.companies) {
    const companyStartTime = Date.now();
    let companyFeatureCount = 0;
    let companySucceeded = 0;

    if (!company.cik) {
      warnings.push(`[features] missing cik ticker=${company.ticker}`);
      processedCompanies += 1;
      input.onProgress?.({
        message: `Factor metric features skipped ${company.ticker}: missing CIK.`,
        current: processedCompanies,
        total: totalCompanies,
        label: company.ticker,
      });
      continue;
    }

    for (const target of input.targets) {
      processed += 1;

      try {
        const result = await buildTickerFactorMetricFeaturesForCik({
          ticker: company.ticker,
          cik: company.cik,
          factor: target.factor,
          axis: target.axis,
          metricKey: target.metricKey,
        });

        featureCount += result.featureCount;
        companyFeatureCount += result.featureCount;
        succeeded += 1;
        companySucceeded += 1;
      } catch (error) {
        if (isMissingInterpretationError(error)) {
          missingInterpretationKeys.add(
            `${target.factor}:${target.axis}:${target.metricKey}`,
          );
          continue;
        }

        const message = error instanceof Error ? error.message : "Unknown error";
        warnings.push(
          `[features] ticker=${company.ticker} factor=${target.factor} axis=${target.axis} metric=${target.metricKey} ${message}`,
        );
      }
    }

    processedCompanies += 1;
    input.onProgress?.({
      message: `Factor metric features completed ${company.ticker} in ${Date.now() - companyStartTime}ms. targets=${companySucceeded}/${input.targets.length}, features=${companyFeatureCount}.`,
      current: processedCompanies,
      total: totalCompanies,
      label: company.ticker,
    });
  }

  for (const key of missingInterpretationKeys) {
    warnings.push(`[features] missing interpretation ${key}`);
  }

  if (input.rebuildComparisons ?? true) {
    const comparisonKeys = new Set(
      input.targets.map((target) => `${target.factor}:${target.axis}`),
    );

    for (const key of comparisonKeys) {
      const [factor, axis] = key.split(":") as [FactorKey, FactorAxisKey];

      input.onProgress?.({
        message: `Feature comparison outputs started for ${factor}/${axis}.`,
        current: processed,
        total: totalTargets,
        label: `${factor}/${axis}`,
      });

      await buildTickerFactorMetricFeatureBaselines({
        factor,
        axis,
      });

      await buildTickerFactorMetricFeaturePositions({
        factor,
        axis,
      });

      await buildTickerFactorMetricMacroContrasts({
        factor,
        axis,
      });

      input.onProgress?.({
        message: `Feature comparison outputs completed for ${factor}/${axis}.`,
        current: processed,
        total: totalTargets,
        label: `${factor}/${axis}`,
      });
    }
  }

  return {
    processed,
    succeeded,
    featureCount,
    warnings,
  };
}
