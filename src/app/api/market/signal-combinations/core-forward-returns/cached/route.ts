import { NextResponse } from "next/server";
import {
  listStoredTickerSignalCoreForwardReturns,
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
    const asOfDates = normalizeAsOfDates(url.searchParams.get("asOfDates"));

    if (asOfDates.length === 0) {
      return NextResponse.json({
        axisScope: normalizeAxisScope(url.searchParams.get("axisScope")),
        results: [],
        missingAsOfDates: [],
      });
    }

    const axisScope = normalizeAxisScope(url.searchParams.get("axisScope"));
    const windows = normalizeWindows(url.searchParams.get("windows"));
    const results = await listStoredTickerSignalCoreForwardReturns({
      axisScope,
      asOfDates,
      windows,
    });
    const resultDates = new Set(results.map((result) => result.asOfDate));

    return NextResponse.json({
      axisScope,
      results,
      missingAsOfDates: asOfDates.filter((date) => !resultDates.has(date)),
    });
  } catch (error) {
    console.error("Cached signal core forward returns fetch failed:", error);

    return NextResponse.json(
      { ok: false, status: "cached_signal_core_forward_returns_fetch_failed" },
      { status: 500 },
    );
  }
}

function normalizeAxisScope(value: string | null): SignalTimelineAxisScope {
  return normalizeSignalTimelineAxisScope(value) ?? "fundamentals";
}

function normalizeAsOfDates(value: string | null) {
  if (!value) return [];

  return [
    ...new Set(
      value
        .split(",")
        .map((item) => item.trim())
        .filter((item) => /^\d{4}-\d{2}-\d{2}$/.test(item)),
    ),
  ];
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
