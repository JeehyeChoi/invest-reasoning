// app/api/prices/route.ts

import { NextResponse } from "next/server";
import { getPrices } from "@/backend/services/market/getPrices";
import { normalizeTickerInput } from "@/shared/utils/tickers";

type PricesRequestBody = {
  tickers?: unknown;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as PricesRequestBody;
		const tickers = normalizeTickerInput(body.tickers);

    if (tickers.length === 0) {
      return NextResponse.json(
        {
          prices: {},
          warnings: [],
          error: "At least one ticker is required.",
        },
        { status: 400 }
      );
    }

    const result = await getPrices({ tickers });

    // ✅ 반드시 shape 보장
    return NextResponse.json({
      prices: result.prices ?? {},
      warnings: result.warnings ?? [],
      error: result.error ?? null,
    });
  } catch (error) {
    console.error("[prices] route error:", error);

    return NextResponse.json(
      {
        prices: {},
        warnings: [],
        error:
          error instanceof Error
            ? error.message
            : "Failed to fetch prices.",
      },
      { status: 500 }
    );
  }
}
