import { NextResponse } from "next/server";

import { getTickerSignalDetail } from "@/backend/services/tickers/getTickerSignalDetail";
import { FACTOR_AXIS_KEYS, type FactorAxisKey } from "@/shared/factors/axes";
import { FACTOR_KEYS, type FactorKey } from "@/shared/factors/factors";

type RouteContext = {
  params: Promise<{ ticker: string; factor: string; axis: string }>;
};

export async function GET(_: Request, context: RouteContext) {
  try {
    const { ticker, factor, axis } = await context.params;

    if (!isFactorKey(factor) || !isFactorAxisKey(axis)) {
      return NextResponse.json(
        { error: `Invalid signal scope: ${factor}/${axis}` },
        { status: 400 },
      );
    }

    const result = await getTickerSignalDetail({ ticker, factor, axis });

    if (!result) {
      return NextResponse.json(
        { error: "Ticker signal detail not found" },
        { status: 404 },
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error(
      "GET /api/tickers/[ticker]/signals/[factor]/[axis] failed:",
      error,
    );

    return NextResponse.json(
      { error: "Failed to get ticker signal detail" },
      { status: 500 },
    );
  }
}

function isFactorKey(value: string): value is FactorKey {
  return (FACTOR_KEYS as readonly string[]).includes(value);
}

function isFactorAxisKey(value: string): value is FactorAxisKey {
  return (FACTOR_AXIS_KEYS as readonly string[]).includes(value);
}
