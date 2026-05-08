import { NextResponse } from "next/server";
import { getTickerFactorMetricClusterOverview } from "@/backend/services/ticker-clustering/getTickerFactorMetricClusterOverview";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const overview = await getTickerFactorMetricClusterOverview({
      runId: url.searchParams.get("runId") ?? undefined,
      factor: url.searchParams.get("factor") ?? undefined,
      axis: url.searchParams.get("axis") ?? undefined,
      normalizationMethod:
        url.searchParams.get("normalizationMethod") ?? undefined,
      vectorMode: url.searchParams.get("vectorMode") ?? undefined,
      vectorSourcePolicy:
        url.searchParams.get("vectorSourcePolicy") ?? undefined,
      runScope:
        url.searchParams.get("runScope") === "single" ||
        url.searchParams.get("runScope") === "combined" ||
        url.searchParams.get("runScope") === "all"
          ? (url.searchParams.get("runScope") as "single" | "combined" | "all")
          : undefined,
    });

    return NextResponse.json(overview);
  } catch (error) {
    console.error("Market cluster overview fetch failed:", error);

    return NextResponse.json(
      { ok: false, status: "market_cluster_overview_fetch_failed" },
      { status: 500 },
    );
  }
}
