import type { TickerImpliedFinancialExpectationsResponse } from "@/shared/expectations/tickerImpliedFinancialExpectations";

export async function fetchTickerImpliedFinancialExpectations(
  ticker: string,
): Promise<TickerImpliedFinancialExpectationsResponse> {
  const response = await fetch(
    `/api/tickers/${encodeURIComponent(ticker)}/expectations`,
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
      `Failed to fetch ticker expectations (${response.status}): ${errorText || response.statusText}`,
    );
  }

  return response.json();
}
