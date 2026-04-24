import { db } from "@/backend/config/db";

import type { TickerOverview } from "@/backend/schemas/tickers/tickerOverview";
import { interpretGrowthMetrics } from "@/backend/services/factors/growth/fundamentals_based/interpretGrowthMetrics";
import { normalizeGrowthMetrics } from "@/backend/services/factors/growth/fundamentals_based/normalizeGrowthMetrics";

import {
  resolveFactorConfigForModel,
  resolveFactorDisplay,
  type FactorModelFamily,
} from "@/backend/config/factors/active";

type TickerProfileRow = {
  ticker: string;
  company_name: string | null;
  description: string | null;
  website: string | null;
  ceo: string | null;
  ipo_date: Date | string | null;
  full_time_employees: number | string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
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
			p.description,
			p.website,
			p.ceo,
			p.ipo_date,
			p.full_time_employees,
			p.city,
			p.state,
			p.zip,
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
			description: profile.description ?? null,
			website: profile.website ?? null,
			ceo: profile.ceo ?? null,
			ipoDate: profile.ipo_date ? toIsoDate(profile.ipo_date) : null,
			fullTimeEmployees: toNullableNumber(profile.full_time_employees),
			city: profile.city ?? null,
			state: profile.state ?? null,
			zip: profile.zip ?? null,
			sector: profile.sector ?? null,
			industry: profile.industry ?? null,
			marketCap: toNullableNumber(profile.market_cap),
		},
    factorMetrics: await Promise.all(
      factorMetricsResult.rows.map(async (row) => {
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

			const isGrowthFundamentalsMetric =
				factor === "growth" && axis === "fundamentals_based";

			const normalizedMetrics = isGrowthFundamentalsMetric
				? normalizeGrowthMetrics(rawMetrics)
				: null;

			const interpretation = isGrowthFundamentalsMetric
				? interpretGrowthMetrics(normalizedMetrics, metricKey)
				: null;

			const display = isGrowthFundamentalsMetric
				? await safeResolveFactorDisplay({ factor, axis, metricKey })
				: null;

			const heuristic = isGrowthFundamentalsMetric
				? await safeResolveFactorConfigForModel({
						factor,
						axis,
						metricKey,
						model: model as FactorModelFamily,
					})
				: null;

			const formulaText = buildFormulaText({
				display,
				heuristic,
			});

			return {
				factor,
				axis,
				metricKey,
				model,
				effectiveDate: row.effective_date ? toIsoDate(row.effective_date) : null,
				score: toNullableNumber(row.score),
				metrics: rawMetrics,
				interpretation,
				display: display
					? {
							...display,
							formula: {
								...display.formula,
								text: formulaText,
							},
						}
					: null,
			};
    })),
  };
}

function buildFormulaText({
  display,
  heuristic,
}: {
  display: any;
  heuristic: any;
}): string | null {
  if (!display || !heuristic) return null;

  const order = display.metricOrder ?? [];
  const labels = display.metricLabels ?? {};
  const coefficients = heuristic?.coefficients ?? heuristic?.weights ?? {};

  const keys = order.filter((key: string) => coefficients[key] != null);

  if (keys.length === 0) return null;

  return keys
    .map((key: string) => {
      const coef = coefficients[key];
      const label = labels[key] ?? key;
      return `${coef}·${label}`;
    })
    .join(" + ");
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

async function safeResolveFactorDisplay(input: {
  factor: any;
  axis: any;
  metricKey: any;
}) {
  try {
    return await resolveFactorDisplay(input);
  } catch {
    return null;
  }
}

async function safeResolveFactorConfigForModel(input: {
  factor: any;
  axis: any;
  metricKey: any;
  model: FactorModelFamily;
}) {
  try {
    const { config } = await resolveFactorConfigForModel(
      {
        factor: input.factor,
        axis: input.axis,
        metricKey: input.metricKey,
      },
      input.model,
    );

    return config;
  } catch {
    return null;
  }
}
