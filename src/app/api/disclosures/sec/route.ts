import { NextResponse } from "next/server";
import { findWatchlistRecentSecDisclosures } from "@/backend/services/disclosures/sec/findWatchlistRecentSecDisclosures";
import { normalizeSecDisclosuresRequest } from "@/features/disclosures/sec/utils/normalizeSecDisclosuresRequest";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { tickers, days, forms } = normalizeSecDisclosuresRequest(body);

    if (tickers.length === 0) {
      return NextResponse.json(
        {
          items: [],
          error: "At least one ticker is required.",
        },
        { status: 400 }
      );
    }

    const result = await findWatchlistRecentSecDisclosures({
      tickers,
      days,
      forms,
    });

    return NextResponse.json(result);
  } catch (error) {

    return NextResponse.json(
      {
        items: [],
        error: "Failed to fetch filings.",
      },
      { status: 500 }
    );
  }
}
