import type { TickerFactorMetricClusterOverview } from "@/shared/market/clusterOverview";

export async function fetchMarketClusterOverview(): Promise<TickerFactorMetricClusterOverview> {
  const response = await fetch("/api/market/cluster/overview");

  if (!response.ok) {
    throw new Error("Failed to fetch market cluster overview.");
  }

  return response.json();
}
