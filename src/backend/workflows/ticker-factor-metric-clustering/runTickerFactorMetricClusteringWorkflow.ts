import { db } from "@/backend/config/db";
import { runTickerFactorMetricClustering } from "@/backend/services/ticker-clustering/runTickerFactorMetricClustering";
import type {
  RunTickerFactorMetricClusteringInput,
  RunTickerFactorMetricClusteringResult,
} from "@/backend/services/ticker-clustering/runTickerFactorMetricClustering";

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

async function loadClusteringTargetsFromFeatures(): Promise<Pick<
  RunTickerFactorMetricClusteringInput,
  "factor" | "axis"
>[]> {
  const result = await db.query<
    Required<Pick<RunTickerFactorMetricClusteringInput, "factor" | "axis">>
  >(
    `
    SELECT DISTINCT
      factor,
      axis
    FROM public.ticker_factor_metric_features
    WHERE feature_value IS NOT NULL
    ORDER BY factor ASC, axis ASC
    `,
  );

  return result.rows;
}

async function loadClusteringTargetsFromSignals(): Promise<Pick<
  RunTickerFactorMetricClusteringInput,
  "factor" | "axis"
>[]> {
  const result = await db.query<
    Required<Pick<RunTickerFactorMetricClusteringInput, "factor" | "axis">>
  >(
    `
    SELECT DISTINCT
      factor,
      axis
    FROM public.ticker_factor_signals
    WHERE model_key = 'factor_signal'
      AND model_version = 'v0'
      AND signal_key IS NOT NULL
    ORDER BY factor ASC, axis ASC
    `,
  );

  return result.rows;
}

function hasExplicitClusteringScope(
  input: RunTickerFactorMetricClusteringWorkflowInput,
) {
  return (
    input.factor !== undefined ||
    input.axis !== undefined ||
    (input.targets !== undefined && input.targets.length > 0)
  );
}

export async function runTickerFactorMetricClusteringWorkflow(
  input: RunTickerFactorMetricClusteringWorkflowInput = {},
): Promise<TickerFactorMetricClusteringWorkflowResult> {
  const vectorMode = input.vectorMode ?? "factor_signal";
  const targets =
    input.targets && input.targets.length > 0
      ? input.targets
      : hasExplicitClusteringScope(input)
        ? [{ factor: input.factor, axis: input.axis }]
        : vectorMode === "factor_signal"
          ? await loadClusteringTargetsFromSignals()
          : await loadClusteringTargetsFromFeatures();
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

  const runScope = input.runScope ?? "both";
  const runTargetSets = resolveRunTargetSets({
    targets: resolvedTargets,
    hasExplicitScope: hasExplicitClusteringScope(input),
    runScope,
  });
  const runs: RunTickerFactorMetricClusteringResult[] = [];

  for (const [index, targetSet] of runTargetSets.entries()) {
    input.onProgress?.({
      message: `Factor metric clustering scope ${index + 1}/${runTargetSets.length}: ${targetSet
        .map((target) => `${target.factor}.${target.axis}`)
        .join(", ")}.`,
      current: index + 1,
      total: runTargetSets.length,
      label: "scope",
    });

    const result = await runTickerFactorMetricClustering({
      ...input,
      targets: targetSet,
      comparisonSetType: input.comparisonSetType ?? "us_public_equities",
      comparisonSetKey: input.comparisonSetKey ?? "all",
      vectorMode,
      vectorSourcePolicy:
        input.vectorSourcePolicy ??
        (vectorMode === "factor_signal" ? "signal_activation" : "feature_value"),
      normalizationMethod: input.normalizationMethod ?? "none",
    });

    runs.push(result);
  }

  const latestRun = runs[runs.length - 1];

  return {
    runs,
    latestRun,
    runId: latestRun.runId,
    tickerCount: latestRun.tickerCount,
    featureCount: latestRun.featureCount,
    clusterCount: latestRun.clusterCount,
  };
}

function resolveRunTargetSets(input: {
  targets: NonNullable<RunTickerFactorMetricClusteringInput["targets"]>;
  hasExplicitScope: boolean;
  runScope: "single" | "combined" | "both";
}): NonNullable<RunTickerFactorMetricClusteringInput["targets"]>[] {
  if (input.hasExplicitScope) return [input.targets];

  if (input.runScope === "single") {
    return input.targets.map((target) => [target]);
  }

  if (input.runScope === "combined") {
    return [input.targets];
  }

  return [
    input.targets,
    ...input.targets.map((target) => [target]),
  ];
}
