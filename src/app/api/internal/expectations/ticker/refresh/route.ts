import { NextResponse } from "next/server";

import { runTickerImpliedFinancialExpectationsWorkflow } from "@/backend/workflows/ticker-implied-financial-expectations/runTickerImpliedFinancialExpectationsWorkflow";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const result = await runTickerImpliedFinancialExpectationsWorkflow({
      tickers: body.tickers,
      asOfDate: body.asOfDate,
      provider: body.provider,
      adjustmentPolicy: body.adjustmentPolicy,
    });

    return NextResponse.json({
      ok: true,
      ...result,
    });
  } catch (error) {
    console.error("Ticker implied financial expectations refresh failed:", error);

    return NextResponse.json(
      { ok: false, status: "ticker_implied_financial_expectations_failed" },
      { status: 500 },
    );
  }
}
