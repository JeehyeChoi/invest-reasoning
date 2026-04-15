import { NextResponse } from "next/server";
import { findWatchlistRecentFilings } from "@/backend/services/filings/findWatchlistRecentFilings";
import { normalizeFilingsRequest } from "@/features/filings/utils/normalizeFilingsRequest";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { tickers, days, forms } = normalizeFilingsRequest(body);

    if (tickers.length === 0) {
      return NextResponse.json(
        {
          items: [],
          error: "At least one ticker is required.",
        },
        { status: 400 }
      );
    }

    const result = await findWatchlistRecentFilings({
      tickers,
      days,
      forms,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("[filings] route error:", error);

    return NextResponse.json(
      {
        items: [],
        error: "Failed to fetch filings.",
      },
      { status: 500 }
    );
  }
}

