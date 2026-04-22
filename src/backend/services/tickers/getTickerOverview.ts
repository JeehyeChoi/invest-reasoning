import { db } from "@/backend/config/db";

import type { TickerOverview } from "@/backend/schemas/tickers/tickerOverview";

import revenueDisplay from "@/backend/config/factors/growth/fundamentals_based/revenue/display.json";
import { interpret as interpretGrowthRevenue } from "@/backend/services/factors/growth/fundamentals_based/revenue/interpret";
import { normalize as normalizeGrowthRevenue } from "@/backend/services/factors/growth/fundamentals_based/revenue/normalize";

type TickerProfileRow = {
  ticker: string;
  company_name: string | null;
};

type TickerClassificationRow = {
  sector: string | null;
  industry: string | null;
};

type TickerMarketDataRow = {
  market_cap: number | string | null;
};

type FactorMetricRow = {
  factor: string;
  axis: string;
  metric_key: string;
  model: string;
  effective_date: Date | string | null;
  score: number | string | null;
  metrics: unknown;
};

function normalizeTicker(ticker: string): string {
  return ticker.trim().toUpperCase();
}

export async function getTickerOverview(
  ticker: string,
): Promise<TickerOverview | null> {
  if (typeof ticker !== "string") {
    throw new Error(
      `getTickerOverview expected string ticker, got ${typeof ticker}: ${JSON.stringify(ticker)}`,
    );
  }

  const normalizedTicker = normalizeTicker(ticker);

  if (!normalizedTicker) {
    throw new Error("getTickerOverview received an empty ticker");
  }

  const profileQuery = `
    SELECT
      p.ticker,
      p.company_name,
      c.sector,
      c.industry,
      m.market_cap
    FROM ticker_profiles p
    LEFT JOIN ticker_classifications c
      ON c.ticker = p.ticker
    LEFT JOIN ticker_market_data m
      ON m.ticker = p.ticker
    WHERE p.ticker = $1
    LIMIT 1
  `;

	const factorMetricsQuery = `
		SELECT DISTINCT ON (factor, axis, metric_key, model)
			factor,
			axis,
			metric_key,
			model,
			effective_date,
			score,
			metrics
		FROM ticker_factor_metrics
		WHERE ticker = $1
		ORDER BY
			factor,
			axis,
			metric_key,
			model,
			effective_date DESC NULLS LAST,
			computed_at DESC
	`;

  const [profileResult, factorMetricsResult] = await Promise.all([
    db.query<
      TickerProfileRow &
      TickerClassificationRow &
      TickerMarketDataRow
    >(profileQuery, [normalizedTicker]),
    db.query<FactorMetricRow>(factorMetricsQuery, [normalizedTicker]),
  ]);

  const profile = profileResult.rows[0] ?? null;

  if (!profile) {
    return null;
  }

  return {
    ticker: normalizedTicker,
    company: {
      ticker: profile.ticker,
      companyName: profile.company_name ?? null,
      sector: profile.sector ?? null,
      industry: profile.industry ?? null,
      marketCap: toNullableNumber(profile.market_cap),
    },
    factorMetrics: factorMetricsResult.rows.map((row) => {
      const factor = row.factor as TickerOverview["factorMetrics"][number]["factor"];
      const axis = row.axis as TickerOverview["factorMetrics"][number]["axis"];
      const metricKey =
        row.metric_key as TickerOverview["factorMetrics"][number]["metricKey"];
      const model =
        row.model as TickerOverview["factorMetrics"][number]["model"];

      const rawMetrics =
        row.metrics && typeof row.metrics === "object"
          ? (row.metrics as Record<string, unknown>)
          : null;

      const isGrowthRevenue =
        factor === "growth" &&
        axis === "fundamentals_based" &&
        metricKey === "revenue";

      const normalizedMetrics = isGrowthRevenue
        ? normalizeGrowthRevenue(rawMetrics)
        : null;

      const interpretation = isGrowthRevenue
        ? interpretGrowthRevenue(normalizedMetrics)
        : null;

      const display = isGrowthRevenue ? revenueDisplay : null;

      return {
        factor,
        axis,
        metricKey,
        model,
        effectiveDate: row.effective_date ? toIsoDate(row.effective_date) : null,
        score: toNullableNumber(row.score),
        metrics: rawMetrics,
        interpretation,
        display,
      };
    }),
  };
}

function toIsoDate(value: Date | string): string {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  return new Date(value).toISOString().slice(0, 10);
}

function toNullableNumber(value: unknown): number | null {
  if (value == null) {
    return null;
  }

  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}
