import { NextResponse } from "next/server";
import { getTickerSignalCombinationOverview } from "@/backend/services/ticker-signal-combinations/getTickerSignalCombinationOverview";
import { normalizeSignalTimelineAxisScope } from "@/shared/market/signalCombinationTimeline";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const axisScope = normalizeSignalTimelineAxisScope(
      url.searchParams.get("axisScope"),
    );

    const overview = await getTickerSignalCombinationOverview({
      asOfDate: url.searchParams.get("asOfDate") ?? undefined,
      axisScope,
      detailMode: "latestFlow",
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
