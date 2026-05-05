import { FACTOR_BLUEPRINTS } from "@/backend/config/factors/blueprints";
import { runTickerFactorMetricClustering } from "@/backend/services/ticker-clustering/runTickerFactorMetricClustering";
import type {
  RunTickerFactorMetricClusteringInput,
  RunTickerFactorMetricClusteringResult,
} from "@/backend/services/ticker-clustering/runTickerFactorMetricClustering";
import type { FactorKey } from "@/shared/factors/factors";
import type { FactorAxisKey } from "@/shared/factors/axes";

export type RunTickerFactorMetricClusteringWorkflowInput =
  RunTickerFactorMetricClusteringInput;

export type TickerFactorMetricClusteringWorkflowResult = {
  runs: RunTickerFactorMetricClusteringResult[];
  latestRun: RunTickerFactorMetricClusteringResult;
  runId: string;
  tickerCount: number;
  featureCount: number;
  clusterCount: number;
};

function buildClusteringTargetsFromBlueprints(): Pick<
  RunTickerFactorMetricClusteringInput,
  "factor" | "axis"
>[] {
  const targets: Pick<
    RunTickerFactorMetricClusteringInput,
    "factor" | "axis"
  >[] = [];

  for (const [factor, factorBlueprint] of Object.entries(FACTOR_BLUEPRINTS)) {
    if (!factorBlueprint) continue;

    for (const [axis, axisBlueprint] of Object.entries(factorBlueprint)) {
      if (axisBlueprint.metricKeys.length === 0) continue;

      targets.push({
        factor: factor as FactorKey,
        axis: axis as FactorAxisKey,
      });
    }
  }

  return targets;
}

function hasExplicitClusteringScope(
  input: RunTickerFactorMetricClusteringWorkflowInput,
) {
  return input.factor !== undefined || input.axis !== undefined;
}

export async function runTickerFactorMetricClusteringWorkflow(
  input: RunTickerFactorMetricClusteringWorkflowInput = {},
): Promise<TickerFactorMetricClusteringWorkflowResult> {
  const targets = hasExplicitClusteringScope(input)
    ? [{ factor: input.factor, axis: input.axis }]
    : buildClusteringTargetsFromBlueprints();
  const resolvedTargets = targets.flatMap((target) =>
    target.factor && target.axis
      ? [
          {
            factor: target.factor,
            axis: target.axis,
          },
        ]
      : [],
  );

  if (resolvedTargets.length === 0) {
    throw new Error("No factor metric clustering targets available.");
  }

  const latestRun = await runTickerFactorMetricClustering({
    ...input,
    targets: resolvedTargets,
    comparisonSetType:
      input.comparisonSetType ??
      (resolvedTargets.length > 1 ? "us_public_equities" : undefined),
    comparisonSetKey: input.comparisonSetKey ?? "all",
    vectorMode: input.vectorMode ?? "metric_feature",
  });

  return {
    runs: [latestRun],
    latestRun,
    runId: latestRun.runId,
    tickerCount: latestRun.tickerCount,
    featureCount: latestRun.featureCount,
    clusterCount: latestRun.clusterCount,
  };
}
