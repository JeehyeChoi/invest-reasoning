import { resolveFactorConfig } from "@/backend/config/factors/active";

import type { FactorModelFamily } from "@/backend/config/factors/active";
import type { FactorKey, FactorScoreAxisKey } from "@/backend/schemas/factor";
import type { GrowthMetricSignalsExtended } from "@/backend/schemas/factors/growth";
import type { SecMetricKey } from "@/backend/schemas/sec/metrics";
import type {
  TickerFactorSnapshotStepResult,
  TickerFactorSnapshotWorkflowState,
} from "@/backend/workflows/ticker-factor-snapshot/workflow.types";

type RunFactorMetricStepDeps<TSeriesPoint, TMetrics, TConfig = unknown> = {
  factor: FactorKey;
  axis: FactorScoreAxisKey;
  metricKey: SecMetricKey;
  logPrefix: string;
  resolve: (input: { cik: string }) => Promise<TSeriesPoint[]>;
  compute: (series: TSeriesPoint[], config: TConfig) => TMetrics | null;
  upsert: (input: {
    ticker: string;
    cik: string;
    effectiveDate: string | null;
    metrics: TMetrics;
    sourcePointCount: number;
    sourceWindowEnd: string | null;
  	model: FactorModelFamily;
  }) => Promise<void>;
  assignInput: (
    state: TickerFactorSnapshotWorkflowState,
    ticker: string,
    factor: FactorKey,
    axis: FactorScoreAxisKey,
    metricKey: SecMetricKey,
    metrics: TMetrics,
  ) => void;
  getSeriesEnd: (point: TSeriesPoint) => string | null;
};

export async function runFactorMetricStep<
  TSeriesPoint,
  TMetrics extends GrowthMetricSignalsExtended,
  TConfig = unknown,
>(
  state: TickerFactorSnapshotWorkflowState,
  deps: RunFactorMetricStepDeps<TSeriesPoint, TMetrics, TConfig>,
): Promise<TickerFactorSnapshotStepResult> {
  const warnings: string[] = [];

  const total = state.tickers.length;
  let processed = 0;
  let succeeded = 0;

  for (const ticker of state.tickers) {
    processed += 1;

    process.stdout.write(
      `\r[${deps.logPrefix}] progress ${processed}/${total} succeeded=${succeeded} warnings=${warnings.length}`,
    );

    const cik = state.meta?.tickerCikMap?.[ticker] ?? null;

    if (!cik) {
      warnings.push(`[${deps.logPrefix}] missing cik ticker=${ticker}`);
      continue;
    }

    try {
      const series = await deps.resolve({ cik });

      if (!series || series.length === 0) {
        warnings.push(`[${deps.logPrefix}] empty series ticker=${ticker}`);
        continue;
      }

      const { model, config } = await resolveFactorConfig({
        factor: deps.factor,
        axis: deps.axis,
        metricKey: deps.metricKey,
      });

      const metrics = deps.compute(series, config as TConfig);

      if (!metrics) {
        warnings.push(
          `[${deps.logPrefix}] compute returned null ticker=${ticker}`,
        );
        continue;
      }

      deps.assignInput(
        state,
        ticker,
        deps.factor,
        deps.axis,
        deps.metricKey,
        metrics,
      );

      const latestPoint = series[series.length - 1];
      const latestEnd = latestPoint ? deps.getSeriesEnd(latestPoint) : null;

      await deps.upsert({
        ticker,
        cik,
        effectiveDate: latestEnd,
        metrics,
        sourcePointCount: series.length,
        sourceWindowEnd: latestEnd,
        model,
      });

      succeeded += 1;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown run error";

      warnings.push(`[${deps.logPrefix}] ticker=${ticker} ${message}`);
    }
  }

  process.stdout.write("\n");

  console.log(
    `[${deps.logPrefix}] done total=${total} succeeded=${succeeded} warnings=${warnings.length}`,
  );

  if (warnings.length > 0) {
    console.log(
      `[${deps.logPrefix}] warning samples:`,
      warnings.slice(0, 10),
    );
  }

  return {
    state,
    warnings,
  };
}
