import { NextResponse } from "next/server";
import { getTickerSignalCombinationTimeline } from "@/backend/services/ticker-signal-combinations/getTickerSignalCombinationTimeline";
import { normalizeSignalTimelineAxisScope } from "@/shared/market/signalCombinationTimeline";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const requestedYears = url.searchParams.get("years");
    const years = requestedYears ? Number(requestedYears) : undefined;
    const includeLatest = url.searchParams.get("includeLatest") !== "false";
    const refresh = url.searchParams.get("refresh") === "true";
    const axisScope = normalizeSignalTimelineAxisScope(
      url.searchParams.get("axisScope"),
    );
    const overview = await getTickerSignalCombinationTimeline({
      years,
      includeLatest,
      refresh,
      axisScope,
    });

    return NextResponse.json(overview);
  } catch (error) {
    console.error("Signal combination timeline fetch failed:", error);

    return NextResponse.json(
      { ok: false, status: "signal_combination_timeline_fetch_failed" },
      { status: 500 },
    );
  }
}
