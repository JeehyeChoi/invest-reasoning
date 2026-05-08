import type { TickerDailyPriceSeries } from "@/shared/tickers/tickerDailyPrices";

export async function fetchTickerDailyPrices(
  ticker: string,
): Promise<TickerDailyPriceSeries> {
  const response = await fetch(
    `/api/tickers/${encodeURIComponent(ticker)}/daily-prices`,
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
      `Failed to fetch ticker daily prices (${response.status}): ${errorText || response.statusText}`,
    );
  }

  return response.json();
}
