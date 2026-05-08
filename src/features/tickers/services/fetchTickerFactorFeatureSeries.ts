import type { FactorAxisKey } from "@/shared/factors/axes";
import type { FactorKey } from "@/shared/factors/factors";
import type { TickerMetricSeries } from "@/shared/tickers/tickerMetricSeries";

export async function fetchTickerFactorFeatureSeries(input: {
  ticker: string;
  factor: FactorKey;
  axis: FactorAxisKey;
  metricKey: string;
  featureKey: string;
}): Promise<TickerMetricSeries> {
  const params = new URLSearchParams({
    factor: input.factor,
    axis: input.axis,
  });
  const response = await fetch(
    `/api/tickers/${encodeURIComponent(input.ticker)}/series/${encodeURIComponent(
      input.metricKey,
    )}/${encodeURIComponent(input.featureKey)}?${params.toString()}`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      cache: "no-store",
    },
  );

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");

    throw new Error(
      `Failed to fetch ticker factor feature series (${response.status}): ${
        errorText || response.statusText
      }`,
    );
  }

  return response.json();
}
