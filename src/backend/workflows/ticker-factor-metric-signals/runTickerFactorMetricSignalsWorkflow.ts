import { FACTOR_BLUEPRINTS } from "@/backend/config/factors/blueprints";
import type { FactorKey, FactorScoreAxisKey } from "@/shared/factors/factors";
import { runTickerFactorMetricSignals } from "@/backend/services/sec/companyFacts/series/signal/runTickerFactorMetricSignals";
import type { SignalRunTarget } from "@/backend/services/sec/companyFacts/series/signal/runTickerFactorMetricSignals";

export type RunTickerFactorMetricSignalsWorkflowInput = {
  tickers: string[];
  tickerCikMap?: Record<string, string | null>;
};

export type TickerFactorMetricSignalsWorkflowResult = {
  warnings: string[];
};

function buildSignalTargetsFromBlueprints(): SignalRunTarget[] {
  const targets: SignalRunTarget[] = [];

  for (const [factor, factorBlueprint] of Object.entries(FACTOR_BLUEPRINTS)) {
    if (!factorBlueprint) continue;

    for (const [axis, axisBlueprint] of Object.entries(factorBlueprint)) {
      for (const metricKey of axisBlueprint.metricKeys) {
        targets.push({
          factor: factor as FactorKey,
          axis: axis as FactorScoreAxisKey,
          metricKey,
        });
      }
    }
  }

  return targets;
}

export async function runTickerFactorMetricSignalsWorkflow(
  input: RunTickerFactorMetricSignalsWorkflowInput,
): Promise<TickerFactorMetricSignalsWorkflowResult> {
  console.log(
    "[metric-signals] writing signal/baseline/position outputs",
  );

  const result = await runTickerFactorMetricSignals({
    companies: input.tickers.map((ticker) => ({
      ticker,
      cik: input.tickerCikMap?.[ticker] ?? null,
    })),
    targets: buildSignalTargetsFromBlueprints(),
    rebuildComparisons: true,
  });

  console.log(
    `[metric-signals] done processed=${result.processed} succeeded=${result.succeeded} signals=${result.signalCount} warnings=${result.warnings.length}`,
  );

  return {
    warnings: result.warnings,
  };
}
