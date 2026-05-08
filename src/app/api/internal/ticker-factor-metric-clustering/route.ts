import { NextResponse } from "next/server";
import { runTickerFactorMetricClusteringWorkflow } from "@/backend/workflows/ticker-factor-metric-clustering/runTickerFactorMetricClusteringWorkflow";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const result = await runTickerFactorMetricClusteringWorkflow({
      factor: body.factor,
      axis: body.axis,
      targets: body.targets,
      comparisonSetType: body.comparisonSetType,
      comparisonSetKey: body.comparisonSetKey,
      asOfDate: body.asOfDate,
      normalizationMethod: body.normalizationMethod,
      vectorMode: body.vectorMode,
      vectorSourcePolicy: body.vectorSourcePolicy,
      runScope: body.runScope,
      clusterMethod: body.clusterMethod,
      clusterCount: body.clusterCount,
      maxIterations: body.maxIterations,
      minTickerCoverageRatio: body.minTickerCoverageRatio,
      minFeatureCoverageRatio: body.minFeatureCoverageRatio,
      minUniverseCount: body.minUniverseCount,
      zScoreClip: body.zScoreClip,
    });

    return NextResponse.json({
      ok: true,
      ...result,
      runCount: result.runs.length,
    });
  } catch (error) {
    console.error("Ticker factor metric clustering failed:", error);

    return NextResponse.json(
      { ok: false, status: "ticker_factor_metric_clustering_failed" },
      { status: 500 },
    );
  }
}
