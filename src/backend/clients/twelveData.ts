// backend/clients/twelveData.ts

import { ENV } from "@/backend/config/env"

type TwelveDataPriceResponse = {
  price?: string;
  code?: number;
  message?: string;
  status?: string;
};

function buildTwelveDataPriceUrl(symbol: string): string {
  const url = new URL("https://api.twelvedata.com/price");
  url.searchParams.set("symbol", symbol);
  url.searchParams.set("apikey", ENV.TWELVEDATA_API_KEY);

  return url.toString();
}

export async function fetchTwelveDataPrice(symbol: string): Promise<number> {
  if (!ENV.TWELVEDATA_API_KEY) {
    throw new Error("Missing TWELVEDATA_API_KEY");
  }

  const res = await fetch(buildTwelveDataPriceUrl(symbol), {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`TwelveData request failed: ${res.status} ${text}`);
  }

  const data = (await res.json()) as TwelveDataPriceResponse;

  if (data.status === "error") {
    throw new Error(data.message ?? "TwelveData returned an error");
  }

  const price = Number(data.price);

  if (!Number.isFinite(price)) {
    throw new Error(`Invalid TwelveData price for ${symbol}`);
  }

  return price;
}
