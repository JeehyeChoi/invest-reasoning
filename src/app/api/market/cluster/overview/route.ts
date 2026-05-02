import { NextResponse } from "next/server";
import { getTickerFactorMetricClusterOverview } from "@/backend/services/ticker-clustering/getTickerFactorMetricClusterOverview";

export async function GET() {
  try {
    const overview = await getTickerFactorMetricClusterOverview();

    return NextResponse.json(overview);
  } catch (error) {
    console.error("Market cluster overview fetch failed:", error);

    return NextResponse.json(
      { ok: false, status: "market_cluster_overview_fetch_failed" },
      { status: 500 },
    );
  }
}
