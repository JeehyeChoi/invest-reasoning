import { NextResponse } from "next/server";
import { runTickerDailyPriceHistorySyncWorkflow } from "@/backend/workflows/ticker-daily-prices/runTickerDailyPriceHistorySyncWorkflow";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));

    const result = await runTickerDailyPriceHistorySyncWorkflow({
      tickers: body.tickers,
      universeKeys: body.universeKeys,
      provider: body.provider,
      adjustmentPolicy: body.adjustmentPolicy,
      endDate: body.endDate,
      yearsBack: body.yearsBack,
      maxTickers: body.maxTickers,
      maxRequests: body.maxRequests,
      outputSize: body.outputSize,
      requestDelayMs: body.requestDelayMs,
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("Ticker daily price history sync failed:", error);

    return NextResponse.json(
      { ok: false, status: "ticker_daily_price_history_sync_failed" },
      { status: 500 },
    );
  }
}
