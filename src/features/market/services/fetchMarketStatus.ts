export type MarketStatusResponse = {
  state: "holiday" | "weekend" | "preopen" | "open" | "closed";
  label: string;
  nowNy: string | null;
};

export async function fetchMarketStatus(): Promise<MarketStatusResponse> {
  const res = await fetch("/api/market-status", {
    method: "GET",
    cache: "no-store",
  });

  const data = (await res.json()) as MarketStatusResponse;

  if (!res.ok) {
    throw new Error("Failed to fetch market status");
  }

  return data;
}
