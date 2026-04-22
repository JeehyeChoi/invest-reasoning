import { NextResponse } from "next/server";

import { getTickerMetricSeries } from "@/backend/services/tickers/getTickerMetricSeries";
import {
  isSecMetricKey,
  type SecMetricKey,
} from "@/backend/schemas/sec/metrics";

type RouteContext = {
  params: Promise<{ ticker: string; metricKey: string }>;
};

export async function GET(_: Request, context: RouteContext) {
  try {
    const { ticker, metricKey } = await context.params;

    if (!isSecMetricKey(metricKey)) {
      return NextResponse.json(
        { error: `Invalid metricKey: ${metricKey}` },
        { status: 400 },
      );
    }

    const result = await getTickerMetricSeries(
      ticker,
      metricKey as SecMetricKey,
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error("GET /api/tickers/[ticker]/series/[metricKey] failed:", error);

    return NextResponse.json(
      { error: "Failed to get ticker metric series" },
      { status: 500 },
    );
  }
}
