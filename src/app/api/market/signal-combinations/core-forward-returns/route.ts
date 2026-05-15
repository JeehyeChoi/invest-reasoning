import { NextResponse } from "next/server";
import {
  getTickerSignalCoreForwardReturns,
  SIGNAL_CORE_FORWARD_WINDOWS,
  type SignalCoreForwardWindow,
} from "@/backend/services/ticker-signal-combinations/getTickerSignalCoreForwardReturns";
import {
  normalizeSignalTimelineAxisScope,
  type SignalTimelineAxisScope,
} from "@/shared/market/signalCombinationTimeline";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const asOfDate = url.searchParams.get("asOfDate");

    if (!asOfDate) {
      return NextResponse.json(
        { ok: false, status: "missing_as_of_date" },
        { status: 400 },
      );
    }

    const axisScope = normalizeAxisScope(url.searchParams.get("axisScope"));
    const windows = normalizeWindows(url.searchParams.get("windows"));
    const includeRows = url.searchParams.get("includeRows") === "true";
    const refresh = url.searchParams.get("refresh") === "true";
    const result = await getTickerSignalCoreForwardReturns({
      asOfDate,
      axisScope,
      windows,
      useCache: !includeRows && !refresh,
    });

    if (includeRows) return NextResponse.json(result);

    const { rows: _rows, ...summary } = result;

    return NextResponse.json(summary);
  } catch (error) {
    console.error("Signal core forward returns fetch failed:", error);

    return NextResponse.json(
      { ok: false, status: "signal_core_forward_returns_fetch_failed" },
      { status: 500 },
    );
  }
}

function normalizeAxisScope(value: string | null): SignalTimelineAxisScope {
  return normalizeSignalTimelineAxisScope(value) ?? "fundamentals";
}

function normalizeWindows(value: string | null) {
  if (!value) return undefined;

  const requested = value
    .split(",")
    .map((item) => item.trim().toUpperCase())
    .filter((item): item is SignalCoreForwardWindow =>
      SIGNAL_CORE_FORWARD_WINDOWS.includes(item as SignalCoreForwardWindow),
    );

  return requested.length > 0 ? requested : undefined;
}
