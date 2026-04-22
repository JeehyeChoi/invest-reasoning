import { run as runGrowthFundamentalsRevenue } from "@/backend/workflows/ticker-factor-snapshot/steps/growth/fundamentals_based/revenue/run";

import type { FactorKey, FactorScoreAxisKey } from "@/backend/schemas/factor";
import type { SecMetricKey } from "@/backend/schemas/sec/metrics";

import type {
  TickerFactorSnapshotStepResult,
  TickerFactorSnapshotWorkflowState,
} from "./workflow.types";

import type {
  StepContext,
  StepRunnerMap,
} from "./workflow.step.types";

type RunTickerFactorSnapshotsWorkflowInput = {
  tickers: string[];
  tickerCikMap?: Record<string, string | null>;
};

const stepRunners: StepRunnerMap = {
  growth: {
    fundamentals_based: {
      revenue: runGrowthFundamentalsRevenue,
    },
  },
};

export async function runTickerFactorSnapshotsWorkflow(
  input: RunTickerFactorSnapshotsWorkflowInput,
): Promise<TickerFactorSnapshotStepResult> {
  let state: TickerFactorSnapshotWorkflowState = {
    tickers: input.tickers,
    meta: {
      tickerCikMap: input.tickerCikMap ?? {},
    },
    factorInputs: {},
    factorScores: {},
    snapshots: [],
  };

  for (const ticker of state.tickers) {
    state.factorInputs[ticker] = {};
  }

  const warnings: string[] = [];

  for (const factor of Object.keys(stepRunners) as FactorKey[]) {
    const axisMap = stepRunners[factor];
    if (!axisMap) continue;

    for (const axis of Object.keys(axisMap) as FactorScoreAxisKey[]) {
      const metricMap = axisMap[axis];
      if (!metricMap) continue;

      for (const metricKey of Object.keys(metricMap) as SecMetricKey[]) {
        const runner = metricMap[metricKey];
        if (!runner) continue;

        const context: StepContext = {
          factor,
          axis,
          metricKey,
        };

        console.log(
          `[workflow] ▶ start step factor=${factor} axis=${axis} metric=${metricKey}`,
        );

        const startedAt = Date.now();

        try {
          const result = await runner(state, context);

          state = result.state;
          warnings.push(...(result.warnings ?? []));

          const duration = Date.now() - startedAt;

          console.log(
            `[workflow] ✔ done step factor=${factor} axis=${axis} metric=${metricKey} (${duration}ms)`,
          );
        } catch (error) {
          const message =
            error instanceof Error
              ? error.message
              : "Unknown factor step error";

          console.error(
            `[workflow] ✖ failed step factor=${factor} axis=${axis} metric=${metricKey}`,
            error,
          );

          warnings.push(
            `[runTickerFactorSnapshotsWorkflow] failed factor=${factor} axis=${axis} metric=${metricKey}: ${message}`,
          );
        }
      }
    }
  }

  console.log(
    `[workflow] done runTickerFactorSnapshotsWorkflow warnings=${warnings.length}`,
  );

  return {
    state,
    warnings,
  };
}
