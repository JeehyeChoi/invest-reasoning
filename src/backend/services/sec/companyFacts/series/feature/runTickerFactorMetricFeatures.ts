import type { FactorKey } from "@/shared/factors/factors";
import type { FactorAxisKey } from "@/shared/factors/axes";
import type { MetricFeatureMetricKey } from "@/backend/services/sec/companyFacts/series/feature/types";
import { buildTickerFactorMetricFeaturesForCik } from "@/backend/services/sec/companyFacts/series/feature/buildTickerFactorMetricFeaturesForCik";

type FeatureRunCompany = {
  ticker: string;
  cik: string | null;
};

export type FeatureRunTarget = {
  factor: FactorKey;
  axis: FactorAxisKey;
  metricKey: MetricFeatureMetricKey;
};

type FeatureRunInput = {
  companies: FeatureRunCompany[];
  targets: FeatureRunTarget[];
  asOfDate?: string;
  maxCompanyConcurrency?: number;
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

function normalizeMaxCompanyConcurrency(value: number | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 1;
  return Math.max(1, Math.floor(value));
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
  let processedCompanies = 0;
  let nextCompanyIndex = 0;
  const maxCompanyConcurrency = normalizeMaxCompanyConcurrency(
    input.maxCompanyConcurrency,
  );

  async function processCompany(company: FeatureRunCompany): Promise<void> {
    const companyStartTime = Date.now();
    let companyFeatureCount = 0;
    let companySucceeded = 0;

    if (!company.cik) {
      warnings.push(`[features] missing cik ticker=${company.ticker}`);
      processedCompanies += 1;
      input.onProgress?.({
        message: `[${processedCompanies}/${totalCompanies}] skipped ${company.ticker}: missing CIK.`,
        current: processedCompanies,
        total: totalCompanies,
        label: company.ticker,
      });
      return;
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
          asOfDate: input.asOfDate,
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
      message: `[${processedCompanies}/${totalCompanies}] completed ${company.ticker} in ${Date.now() - companyStartTime}ms. targets=${companySucceeded}/${input.targets.length}, features=${companyFeatureCount}.`,
      current: processedCompanies,
      total: totalCompanies,
      label: company.ticker,
    });
  }

  async function runWorker(): Promise<void> {
    while (nextCompanyIndex < input.companies.length) {
      const company = input.companies[nextCompanyIndex];
      nextCompanyIndex += 1;
      await processCompany(company);
    }
  }

  await Promise.all(
    Array.from(
      { length: Math.min(maxCompanyConcurrency, input.companies.length) },
      () => runWorker(),
    ),
  );

  for (const key of missingInterpretationKeys) {
    warnings.push(`[features] missing interpretation ${key}`);
  }

  return {
    processed,
    succeeded,
    featureCount,
    warnings,
  };
}
