import { NextResponse } from "next/server";
import { runMacroFredSeriesSyncWorkflow } from "@/backend/workflows/macro-fred-series/runMacroFredSeriesSyncWorkflow";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));

    const result = await runMacroFredSeriesSyncWorkflow({
      observationStart: body.observationStart,
      observationEnd: body.observationEnd,
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("FRED macro series sync failed:", error);

    return NextResponse.json(
      { ok: false, status: "macro_fred_series_sync_failed" },
      { status: 500 },
    );
  }
}
