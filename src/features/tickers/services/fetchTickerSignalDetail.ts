import type { FactorAxisKey } from "@/shared/factors/axes";
import type { FactorKey } from "@/shared/factors/factors";
import type { TickerSignalDetail } from "@/shared/tickers/tickerOverview";

export async function fetchTickerSignalDetail(input: {
  ticker: string;
  factor: FactorKey;
  axis: FactorAxisKey;
}): Promise<TickerSignalDetail> {
  const response = await fetch(
    `/api/tickers/${encodeURIComponent(input.ticker)}/signals/${encodeURIComponent(input.factor)}/${encodeURIComponent(input.axis)}`,
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
      `Failed to fetch ticker signal detail (${response.status}): ${
        errorText || response.statusText
      }`,
    );
  }

  return response.json();
}
