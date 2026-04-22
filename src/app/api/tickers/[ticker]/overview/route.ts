import { NextResponse } from "next/server";
import { getTickerOverview } from "@/backend/services/tickers/getTickerOverview";

type RouteContext = {
  params: Promise<{ ticker: string }>;
};

export async function GET(_: Request, context: RouteContext) {
  try {
    const { ticker } = await context.params;
    const result = await getTickerOverview(ticker);

    if (!result) {
      return NextResponse.json(
        { error: "Ticker overview not found" },
        { status: 404 },
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("GET /api/tickers/[ticker]/overview failed:", error);

    return NextResponse.json(
      { error: "Failed to get ticker overview" },
      { status: 500 },
    );
  }
}
