import { NextResponse } from "next/server";
import { getFredMacroSeriesOverview } from "@/backend/services/macro/fred/getFredMacroSeriesOverview";

export async function GET() {
  try {
    const overview = await getFredMacroSeriesOverview();

    return NextResponse.json(overview);
  } catch (error) {
    console.error("FRED macro series overview fetch failed:", error);

    return NextResponse.json(
      { ok: false, status: "fred_macro_series_overview_fetch_failed" },
      { status: 500 },
    );
  }
}
