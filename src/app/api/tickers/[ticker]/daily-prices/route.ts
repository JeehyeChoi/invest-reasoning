import { NextResponse } from "next/server";

import { getTickerDailyPriceSeries } from "@/backend/services/tickers/getTickerDailyPriceSeries";

type RouteContext = {
  params: Promise<{ ticker: string }>;
};

export async function GET(_: Request, context: RouteContext) {
  try {
    const { ticker } = await context.params;
    const result = await getTickerDailyPriceSeries(ticker);

    return NextResponse.json(result);
  } catch (error) {
    console.error("GET /api/tickers/[ticker]/daily-prices failed:", error);

    return NextResponse.json(
      { error: "Failed to get ticker daily price series" },
      { status: 500 },
    );
  }
}
