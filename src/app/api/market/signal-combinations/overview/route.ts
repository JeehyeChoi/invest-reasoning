import { NextResponse } from "next/server";
import { getTickerSignalCombinationOverview } from "@/backend/services/ticker-signal-combinations/getTickerSignalCombinationOverview";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const overview = await getTickerSignalCombinationOverview({
      asOfDate: url.searchParams.get("asOfDate") ?? undefined,
    });

    return NextResponse.json(overview);
  } catch (error) {
    console.error("Signal combination overview fetch failed:", error);

    return NextResponse.json(
      { ok: false, status: "signal_combination_overview_fetch_failed" },
      { status: 500 },
    );
  }
}
