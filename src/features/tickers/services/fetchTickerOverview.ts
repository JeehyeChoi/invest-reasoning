import type { TickerOverview } from "@/backend/schemas/tickers/tickerOverview";

export async function fetchTickerOverview(
  ticker: string,
): Promise<TickerOverview> {
  const response = await fetch(
    `/api/tickers/${encodeURIComponent(ticker)}/overview`,
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
      `Failed to fetch ticker overview (${response.status}): ${errorText || response.statusText}`,
    );
  }

  return response.json();
}
