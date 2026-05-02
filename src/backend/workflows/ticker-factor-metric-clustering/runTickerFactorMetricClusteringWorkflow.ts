import { runTickerFactorMetricClustering } from "@/backend/services/ticker-clustering/runTickerFactorMetricClustering";
import type { RunTickerFactorMetricClusteringInput } from "@/backend/services/ticker-clustering/runTickerFactorMetricClustering";

export type RunTickerFactorMetricClusteringWorkflowInput =
  RunTickerFactorMetricClusteringInput;

export async function runTickerFactorMetricClusteringWorkflow(
  input: RunTickerFactorMetricClusteringWorkflowInput = {},
) {
  console.log("[metric-clustering] building ticker signal vectors");

  const result = await runTickerFactorMetricClustering(input);

  console.log(
    `[metric-clustering] done run=${result.runId} tickers=${result.tickerCount} features=${result.featureCount} clusters=${result.clusterCount}`,
  );

  return result;
}
