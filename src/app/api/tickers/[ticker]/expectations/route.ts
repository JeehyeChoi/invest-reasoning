import { NextResponse } from "next/server";

import { getTickerImpliedFinancialExpectations } from "@/backend/services/expectations/ticker/getTickerImpliedFinancialExpectations";

type RouteContext = {
  params: Promise<{ ticker: string }>;
};

export async function GET(_: Request, context: RouteContext) {
  try {
    const { ticker } = await context.params;
    const result = await getTickerImpliedFinancialExpectations(ticker);

    return NextResponse.json(result);
  } catch (error) {
    console.error("GET /api/tickers/[ticker]/expectations failed:", error);

    return NextResponse.json(
      { error: "Failed to get ticker expectations" },
      { status: 500 },
    );
  }
}
