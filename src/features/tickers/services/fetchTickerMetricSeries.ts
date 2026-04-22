import type { SecMetricKey } from "@/backend/schemas/sec/metrics";
import type { TickerMetricSeries } from "@/backend/schemas/tickers/tickerMetricSeries";

export async function fetchTickerMetricSeries(
  ticker: string,
  metricKey: SecMetricKey,
): Promise<TickerMetricSeries> {
  const response = await fetch(
    `/api/tickers/${encodeURIComponent(ticker)}/series/${encodeURIComponent(metricKey)}`,
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
      `Failed to fetch ticker metric series (${response.status}): ${errorText || response.statusText}`,
    );
  }

  return response.json();
}
