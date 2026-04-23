import { FACTOR_BLUEPRINTS } from "@/backend/config/factors/blueprints";

import type { FactorKey, FactorScoreAxisKey } from "@/backend/schemas/factor";
import type { SecMetricKey } from "@/backend/schemas/sec/metrics";

import type {
  TickerFactorSnapshotStepResult,
  TickerFactorSnapshotWorkflowState,
} from "./workflow.types";

import type { StepContext } from "./workflow.step.types";
import { STEP_RUNNERS } from "./stepRunners";

type RunTickerFactorSnapshotsWorkflowInput = {
  tickers: string[];
  tickerCikMap?: Record<string, string | null>;
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

  for (const factor of Object.keys(FACTOR_BLUEPRINTS) as FactorKey[]) {
    const factorBlueprint = FACTOR_BLUEPRINTS[factor];
    if (!factorBlueprint) continue;

    for (const axis of Object.keys(factorBlueprint) as FactorScoreAxisKey[]) {
      const axisBlueprint = factorBlueprint[axis];
      if (!axisBlueprint) continue;

      for (const metricKey of axisBlueprint.metricKeys as SecMetricKey[]) {
        const runner = STEP_RUNNERS[factor]?.[axis]?.[metricKey];

        if (!runner) {
          warnings.push(
            `[runTickerFactorSnapshotsWorkflow] missing runner for factor=${factor} axis=${axis} metric=${metricKey}`,
          );
          continue;
        }

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
