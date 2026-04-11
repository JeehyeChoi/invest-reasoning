import { NextResponse } from "next/server";
import { resolveTickerMetadata } from "@/backend/services/metadata/resolveTickerMetadata";

type RouteContext = {
  params: Promise<{ ticker: string }>;
};

export async function GET(_: Request, context: RouteContext) {
  try {
    const { ticker } = await context.params;
    const result = await resolveTickerMetadata(ticker);

    if (!result) {
      return NextResponse.json(
        { error: "Ticker metadata not found" },
        { status: 404 },
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("GET /api/tickers/[ticker] failed:", error);
    return NextResponse.json(
      { error: "Failed to resolve ticker metadata" },
      { status: 500 },
    );
  }
}
