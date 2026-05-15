import { NextResponse } from "next/server";
import { runDataPipelineRefreshJob } from "@/backend/workflows/data-pipeline-refresh/runDataPipelineRefreshJob";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));

    const result = await runDataPipelineRefreshJob(
      {
        jobs: body.jobs,
        rebuild: body.rebuild,
        rebuildMode: body.rebuildMode,
        companyScope: body.companyScope,
        universeRefreshMode: body.universeRefreshMode,
        universeKeys: body.universeKeys,
        tickerCoreSyncMode: body.tickerCoreSyncMode,
        tickerCoreMaxRequests: body.tickerCoreMaxRequests,
        tickerCoreTickers: body.tickerCoreTickers,
        secTagCandidateDiscovery: body.secTagCandidateDiscovery,
        secMetricSeriesExperimentMaxCiks: body.secMetricSeriesExperimentMaxCiks,
        secMetricSeriesExperimentClearBeforeRun:
          body.secMetricSeriesExperimentClearBeforeRun,
        tickerDailyPriceProvider: body.tickerDailyPriceProvider,
        tickerDailyPriceAdjustmentPolicy: body.tickerDailyPriceAdjustmentPolicy,
        tickerDailyPriceEndDate: body.tickerDailyPriceEndDate,
        tickerDailyPriceYearsBack: body.tickerDailyPriceYearsBack,
        tickerDailyPriceMaxTickers: body.tickerDailyPriceMaxTickers,
        tickerDailyPriceMaxRequests: body.tickerDailyPriceMaxRequests,
        tickerDailyPriceTickers: body.tickerDailyPriceTickers,
        factorFeatureAsOfDate: body.factorFeatureAsOfDate,
        signalPercolationAxisScopes: body.signalPercolationAxisScopes,
        signalPercolationClearBeforeRun: body.signalPercolationClearBeforeRun,
      },
      {
        targetSlot: body.targetSlot,
      },
    );

    if (result.status === "already_running") {
      return NextResponse.json(result, { status: 409 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Data pipeline refresh trigger failed:", error);

    return NextResponse.json(
      { ok: false, status: "trigger_failed" },
      { status: 500 },
    );
  }
}
