import { NextResponse } from "next/server";

import { getTickerFactorFeatureSeries } from "@/backend/services/tickers/getTickerFactorFeatureSeries";
import { FACTOR_AXIS_KEYS, type FactorAxisKey } from "@/shared/factors/axes";
import { FACTOR_KEYS, type FactorKey } from "@/shared/factors/factors";

type RouteContext = {
  params: Promise<{
    ticker: string;
    metricKey: string;
    featureKey: string;
  }>;
};

export async function GET(request: Request, context: RouteContext) {
  try {
    const { ticker, metricKey, featureKey } = await context.params;
    const url = new URL(request.url);
    const factor = url.searchParams.get("factor");
    const axis = url.searchParams.get("axis");

    if (!isFactorKey(factor)) {
      return NextResponse.json(
        { error: `Invalid factor: ${factor ?? ""}` },
        { status: 400 },
      );
    }

    if (!isFactorAxisKey(axis)) {
      return NextResponse.json(
        { error: `Invalid axis: ${axis ?? ""}` },
        { status: 400 },
      );
    }

    const result = await getTickerFactorFeatureSeries({
      ticker,
      factor,
      axis,
      metricKey,
      featureKey,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error(
      "GET /api/tickers/[ticker]/series/[metricKey]/[featureKey] failed:",
      error,
    );

    return NextResponse.json(
      { error: "Failed to get ticker factor feature series" },
      { status: 500 },
    );
  }
}

function isFactorKey(value: string | null): value is FactorKey {
  return Boolean(value && (FACTOR_KEYS as readonly string[]).includes(value));
}

function isFactorAxisKey(value: string | null): value is FactorAxisKey {
  return Boolean(value && (FACTOR_AXIS_KEYS as readonly string[]).includes(value));
}
