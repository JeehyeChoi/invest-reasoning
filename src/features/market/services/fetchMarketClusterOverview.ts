import type { TickerFactorMetricClusterOverview } from "@/shared/market/clusterOverview";

export type FetchMarketClusterOverviewInput = {
  runId?: string;
  factor?: string;
  axis?: string;
  normalizationMethod?: string;
  vectorMode?: string;
  vectorSourcePolicy?: string;
  runScope?: "single" | "combined" | "all";
};

export async function fetchMarketClusterOverview(
  input: FetchMarketClusterOverviewInput = {},
): Promise<TickerFactorMetricClusterOverview> {
  const params = new URLSearchParams();
  if (input.runId) params.set("runId", input.runId);
  if (input.factor) params.set("factor", input.factor);
  if (input.axis) params.set("axis", input.axis);
  if (input.normalizationMethod) {
    params.set("normalizationMethod", input.normalizationMethod);
  }
  if (input.vectorMode) params.set("vectorMode", input.vectorMode);
  if (input.vectorSourcePolicy) {
    params.set("vectorSourcePolicy", input.vectorSourcePolicy);
  }
  if (input.runScope) params.set("runScope", input.runScope);
  const query = params.toString();
  const response = await fetch(
    `/api/market/cluster/overview${query ? `?${query}` : ""}`,
  );

  if (!response.ok) {
    throw new Error("Failed to fetch market cluster overview.");
  }

  return response.json();
}
