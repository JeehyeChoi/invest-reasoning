import type { FactorKey, FactorScoreAxisKey } from "@/shared/factors/factors";
import type { SecMetricKey } from "@/shared/sec/metrics";
import { buildTickerFactorMetricSignalsForCik } from "@/backend/services/sec/companyFacts/series/signal/buildTickerFactorMetricSignalsForCik";
import { buildTickerFactorMetricBaselines } from "@/backend/services/sec/companyFacts/series/signal/buildTickerFactorMetricBaselines";
import { buildTickerFactorMetricSignalPositions } from "@/backend/services/sec/companyFacts/series/signal/buildTickerFactorMetricSignalPositions";
import { buildTickerFactorMetricSignalHeadlines } from "@/backend/services/sec/companyFacts/series/signal/buildTickerFactorMetricSignalHeadlines";

type SignalRunCompany = {
  ticker: string;
  cik: string | null;
};

export type SignalRunTarget = {
  factor: FactorKey;
  axis: FactorScoreAxisKey;
  metricKey: SecMetricKey;
};

type SignalRunInput = {
  companies: SignalRunCompany[];
  targets: SignalRunTarget[];
  rebuildComparisons?: boolean;
};

type SignalRunResult = {
  processed: number;
  succeeded: number;
  signalCount: number;
  warnings: string[];
};

function isMissingInterpretationError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as NodeJS.ErrnoException).code === "ENOENT"
  );
}

export async function runTickerFactorMetricSignals(
  input: SignalRunInput,
): Promise<SignalRunResult> {
  const warnings: string[] = [];
  const missingInterpretationKeys = new Set<string>();
  let processed = 0;
  let succeeded = 0;
  let signalCount = 0;

  for (const company of input.companies) {
    if (!company.cik) {
      warnings.push(`[signals] missing cik ticker=${company.ticker}`);
      continue;
    }

    for (const target of input.targets) {
      processed += 1;

      try {
        const result = await buildTickerFactorMetricSignalsForCik({
          ticker: company.ticker,
          cik: company.cik,
          factor: target.factor,
          axis: target.axis,
          metricKey: target.metricKey,
        });

        signalCount += result.signalCount;
        succeeded += 1;
      } catch (error) {
        if (isMissingInterpretationError(error)) {
          missingInterpretationKeys.add(
            `${target.factor}:${target.axis}:${target.metricKey}`,
          );
          continue;
        }

        const message = error instanceof Error ? error.message : "Unknown error";
        warnings.push(
          `[signals] ticker=${company.ticker} factor=${target.factor} axis=${target.axis} metric=${target.metricKey} ${message}`,
        );
      }
    }
  }

  for (const key of missingInterpretationKeys) {
    warnings.push(`[signals] missing interpretation ${key}`);
  }

  if (input.rebuildComparisons ?? true) {
    const comparisonKeys = new Set(
      input.targets.map((target) => `${target.factor}:${target.axis}`),
    );

    for (const key of comparisonKeys) {
      const [factor, axis] = key.split(":") as [FactorKey, FactorScoreAxisKey];

      await buildTickerFactorMetricBaselines({
        factor,
        axis,
      });

      await buildTickerFactorMetricSignalPositions({
        factor,
        axis,
      });

      await buildTickerFactorMetricSignalHeadlines({
        factor,
        axis,
      });
    }
  }

  return {
    processed,
    succeeded,
    signalCount,
    warnings,
  };
}
