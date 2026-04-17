import { NextResponse } from "next/server";
import { getPrices } from "@/backend/services/market/getPrices";

type PricePositionInput = {
  ticker?: string;
  totalCost?: number | null;
};

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const items =
      Array.isArray(body?.items)
        ? body.items
        : Array.isArray(body?.positions)
        ? body.positions.map((position: PricePositionInput) => ({
            ticker: position.ticker,
            totalCost: Number(position.totalCost ?? 0),
          }))
        : Array.isArray(body?.tickers)
        ? body.tickers.map((ticker: string) => ({
            ticker,
            totalCost: 0,
          }))
        : [];

    const result = await getPrices({ items });

    return NextResponse.json(result);
  } catch (error) {
    console.error("[prices] route error:", error);

    return NextResponse.json(
      {
        prices: {},
        warnings: [],
        error: error instanceof Error ? error.message : "Unknown prices error",
      },
      { status: 500 }
    );
  }
}
