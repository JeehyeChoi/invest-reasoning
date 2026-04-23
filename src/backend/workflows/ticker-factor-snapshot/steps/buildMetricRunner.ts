import { runFactorMetricStep } from "@/backend/workflows/ticker-factor-snapshot/steps/runFactorMetricStep";

import type { FactorModelFamily } from "@/backend/config/factors/active";
import type { FactorKey, FactorScoreAxisKey } from "@/backend/schemas/factor";
import type { GrowthMetricSignalsExtended } from "@/backend/schemas/factors/growth";
import type { SecMetricKey } from "@/backend/schemas/sec/metrics";
import type {
  TickerFactorSnapshotStepResult,
  TickerFactorSnapshotWorkflowState,
} from "@/backend/workflows/ticker-factor-snapshot/workflow.types";

type buildMetricRunnerInput<TSeriesPoint, TMetrics, TConfig = unknown> = {
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
  getSeriesEnd: (point: TSeriesPoint) => string | null;
};

export function buildMetricRunner<
  TSeriesPoint,
  TMetrics extends GrowthMetricSignalsExtended,
  TConfig = unknown,
>(
  input: buildMetricRunnerInput<TSeriesPoint, TMetrics, TConfig>,
) {
  return async function run(
    state: TickerFactorSnapshotWorkflowState,
  ): Promise<TickerFactorSnapshotStepResult> {
    return runFactorMetricStep(state, {
      factor: input.factor,
      axis: input.axis,
      metricKey: input.metricKey,
      logPrefix: input.logPrefix,
      resolve: input.resolve,
      compute: input.compute,
      upsert: input.upsert,
      getSeriesEnd: input.getSeriesEnd,
      assignInput: (state, ticker, factor, axis, metricKey, metrics) => {
        state.factorInputs[ticker] ??= {};
        state.factorInputs[ticker][factor] ??= {};
        state.factorInputs[ticker][factor]![axis] ??= {};
        state.factorInputs[ticker][factor]![axis]![metricKey] = metrics;
      },
    });
  };
}
