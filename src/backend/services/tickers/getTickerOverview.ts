import { db } from "@/backend/config/db";
import { FACTOR_BLUEPRINTS } from "@/backend/config/factors/blueprints";

import type { TickerOverview } from "@/shared/tickers/tickerOverview";
import { isSecMetricKey } from "@/shared/sec/metrics";
import { resolveFactorDisplay } from "@/backend/config/factors/active";
import { deriveTickerFactorMetricGrowthHeadlineInterpretation } from "@/backend/services/tickers/deriveTickerFactorMetricGrowthHeadlineInterpretation";

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
	latest_fiscal_year: number | string | null;
	latest_annual_start: Date | string | null;
	latest_annual_end: Date | string | null;
	fiscal_year_end_month: number | string | null;
	fiscal_year_end_day: number | string | null;
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
  headline_period_end: Date | string | null;
  headline_effective_date: Date | string | null;
  latest_growth_value: number | string | null;
  latest_growth_method: string | null;
  durable_growth_value: number | string | null;
  durable_growth_method: string | null;
  consistency_value: number | string | null;
  consistency_method: string | null;
  coverage_value: number | string | null;
  coverage_method: string | null;
  acceleration_value: number | string | null;
  acceleration_method: string | null;
  trend_deviation_value: number | string | null;
  trend_deviation_method: string | null;
  primary_signal_key: string | null;
  primary_signal_value: number | string | null;
  primary_signal_method: string | null;
  data_quality_level: string | null;
  us_public_equities_percentile: number | string | null;
  us_public_equities_effective_date: Date | string | null;
  us_public_equities_z_score: number | string | null;
  us_public_equities_distance_to_median: number | string | null;
  us_public_equities_quartile: number | string | null;
  us_public_equities_decile: number | string | null;
  us_public_equities_universe_count: number | string | null;
  sector_percentile: number | string | null;
  sector_effective_date: Date | string | null;
  sector_z_score: number | string | null;
  sector_distance_to_median: number | string | null;
  sector_quartile: number | string | null;
  sector_decile: number | string | null;
  sector_universe_count: number | string | null;
  sector_key: string | null;
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
			i.ticker,
			i.company_name,
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
			m.market_cap,
			f.latest_fiscal_year,
		  f.latest_annual_start,
		  f.latest_annual_end,
		  f.fiscal_year_end_month,
		  f.fiscal_year_end_day
		FROM ticker_identities i
		LEFT JOIN ticker_company_profiles p
			ON p.ticker = i.ticker
		LEFT JOIN ticker_company_classifications c
			ON c.ticker = i.ticker
		LEFT JOIN ticker_market_snapshots m
			ON m.ticker = i.ticker
		LEFT JOIN sec_company_fiscal_profiles f
      ON f.ticker = i.ticker
		WHERE i.ticker = $1
		LIMIT 1
	`;

	const factorMetricsQuery = `
		SELECT
			h.factor,
			h.axis,
			h.metric_key,
			h.headline_period_end,
			h.headline_effective_date,
			h.latest_growth_value,
			h.latest_growth_method,
			h.durable_growth_value,
			h.durable_growth_method,
			h.consistency_value,
			h.consistency_method,
			h.coverage_value,
			h.coverage_method,
			h.acceleration_value,
			h.acceleration_method,
			h.trend_deviation_value,
			h.trend_deviation_method,
			h.primary_signal_key,
			h.primary_signal_value,
			h.primary_signal_method,
			h.data_quality_level,
			us_public_equities.percentile AS us_public_equities_percentile,
			us_public_equities.effective_date AS us_public_equities_effective_date,
			us_public_equities.z_score AS us_public_equities_z_score,
			us_public_equities.distance_to_median AS us_public_equities_distance_to_median,
			us_public_equities.quartile AS us_public_equities_quartile,
			us_public_equities.decile AS us_public_equities_decile,
			us_public_equities.universe_count AS us_public_equities_universe_count,
			sector.percentile AS sector_percentile,
			sector.effective_date AS sector_effective_date,
			sector.z_score AS sector_z_score,
			sector.distance_to_median AS sector_distance_to_median,
			sector.quartile AS sector_quartile,
			sector.decile AS sector_decile,
			sector.universe_count AS sector_universe_count,
			sector.comparison_set_key AS sector_key
		FROM public.ticker_factor_metric_signal_headlines h
		LEFT JOIN public.ticker_factor_metric_signal_positions us_public_equities
			ON us_public_equities.ticker = h.ticker
			AND us_public_equities.factor = h.factor
			AND us_public_equities.axis = h.axis
			AND us_public_equities.metric_key = h.metric_key
			AND us_public_equities.signal_key = h.primary_signal_key
			AND us_public_equities.comparison_set_type = 'us_public_equities'
			AND us_public_equities.comparison_set_key = 'all'
			AND us_public_equities.effective_date = h.headline_effective_date
		LEFT JOIN public.ticker_factor_metric_signal_positions sector
			ON sector.ticker = h.ticker
			AND sector.factor = h.factor
			AND sector.axis = h.axis
			AND sector.metric_key = h.metric_key
			AND sector.signal_key = h.primary_signal_key
			AND sector.comparison_set_type = 'sector'
			AND sector.effective_date = h.headline_effective_date
		WHERE h.ticker = $1
		ORDER BY h.factor, h.axis, h.metric_key
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

  const activeFactorMetrics = factorMetricsResult.rows.filter((row) => {
    const factorBlueprint = FACTOR_BLUEPRINTS[row.factor as keyof typeof FACTOR_BLUEPRINTS];
    const axisBlueprint =
      factorBlueprint?.[row.axis as keyof typeof factorBlueprint];

    if (!axisBlueprint || !isSecMetricKey(row.metric_key)) {
      return false;
    }

    return axisBlueprint.metricKeys.includes(row.metric_key);
  });

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
			fiscalProfile: {
				latestFiscalYear: toNullableNumber(profile.latest_fiscal_year),
				latestAnnualStart: profile.latest_annual_start
					? toIsoDate(profile.latest_annual_start)
					: null,
				latestAnnualEnd: profile.latest_annual_end
					? toIsoDate(profile.latest_annual_end)
					: null,
				fiscalYearEndMonth: toNullableNumber(profile.fiscal_year_end_month),
				fiscalYearEndDay: toNullableNumber(profile.fiscal_year_end_day),
			},
		},
    factorMetrics: await Promise.all(
      activeFactorMetrics.map(async (row) => {
      const factor = row.factor as TickerOverview["factorMetrics"][number]["factor"];
      const axis = row.axis as TickerOverview["factorMetrics"][number]["axis"];
      const metricKey =
        row.metric_key as TickerOverview["factorMetrics"][number]["metricKey"];

			const display = await safeResolveFactorDisplay({ factor, axis, metricKey });
      const latestGrowthValue = toNullableNumber(row.latest_growth_value);
      const durableGrowthValue = toNullableNumber(row.durable_growth_value);
      const consistencyValue = toNullableNumber(row.consistency_value);
      const coverageValue = toNullableNumber(row.coverage_value);
      const accelerationValue = toNullableNumber(row.acceleration_value);
      const trendDeviationValue = toNullableNumber(row.trend_deviation_value);
      const primarySignalValue = toNullableNumber(row.primary_signal_value);
      const usPublicEquitiesPosition = {
        comparisonSetType: "us_public_equities",
        comparisonSetKey: "all",
        effectiveDate: row.us_public_equities_effective_date
          ? toIsoDate(row.us_public_equities_effective_date)
          : null,
        signalKey: row.primary_signal_key ?? "",
        signalValue: primarySignalValue,
        percentile: toNullableNumber(row.us_public_equities_percentile),
        zScore: toNullableNumber(row.us_public_equities_z_score),
        distanceToMedian: toNullableNumber(
          row.us_public_equities_distance_to_median,
        ),
        quartile: toNullableNumber(row.us_public_equities_quartile),
        decile: toNullableNumber(row.us_public_equities_decile),
        universeCount: toNullableNumber(row.us_public_equities_universe_count),
      };
      const sectorPosition = {
        comparisonSetType: "sector",
        comparisonSetKey: row.sector_key ?? "-",
        effectiveDate: row.sector_effective_date
          ? toIsoDate(row.sector_effective_date)
          : null,
        signalKey: row.primary_signal_key ?? "",
        signalValue: primarySignalValue,
        percentile: toNullableNumber(row.sector_percentile),
        zScore: toNullableNumber(row.sector_z_score),
        distanceToMedian: toNullableNumber(row.sector_distance_to_median),
        quartile: toNullableNumber(row.sector_quartile),
        decile: toNullableNumber(row.sector_decile),
        universeCount: toNullableNumber(row.sector_universe_count),
      };
      const growthInterpretation =
        deriveTickerFactorMetricGrowthHeadlineInterpretation({
          metricKey,
          latestGrowthValue,
          durableGrowthValue,
          consistencyValue,
          coverageValue,
          accelerationValue,
          trendDeviationValue,
          dataQualityLevel: row.data_quality_level,
          usPublicEquitiesPercentile: usPublicEquitiesPosition.percentile,
          usPublicEquitiesDistanceToMedian:
            usPublicEquitiesPosition.distanceToMedian,
          sectorPercentile: sectorPosition.percentile,
        });

			return {
				factor,
				axis,
				metricKey,
				method: "signal_headline" as const,
				effectiveDate: row.headline_effective_date
          ? toIsoDate(row.headline_effective_date)
          : null,
				score: primarySignalValue,
				metrics: null,
				interpretation: null,
				display,
        headline: {
          headlinePeriodEnd: row.headline_period_end
            ? toIsoDate(row.headline_period_end)
            : null,
          headlineEffectiveDate: row.headline_effective_date
            ? toIsoDate(row.headline_effective_date)
            : null,
          interpretationLabel: growthInterpretation.label,
          interpretationSummary: growthInterpretation.summary,
          latestGrowthValue,
          latestGrowthMethod: row.latest_growth_method,
          durableGrowthValue,
          durableGrowthMethod: row.durable_growth_method,
          consistencyValue,
          consistencyMethod: row.consistency_method,
          coverageValue,
          coverageMethod: row.coverage_method,
          accelerationValue,
          accelerationMethod: row.acceleration_method,
          trendDeviationValue,
          trendDeviationMethod: row.trend_deviation_method,
          primarySignalKey: row.primary_signal_key,
          primarySignalValue,
          primarySignalMethod: row.primary_signal_method,
          dataQualityLevel: row.data_quality_level,
        },
        positions: [usPublicEquitiesPosition, sectorPosition],
			};
    })),
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

async function safeResolveFactorDisplay(input: {
  factor: Parameters<typeof resolveFactorDisplay>[0]["factor"];
  axis: Parameters<typeof resolveFactorDisplay>[0]["axis"];
  metricKey: Parameters<typeof resolveFactorDisplay>[0]["metricKey"];
}) {
  try {
    return await resolveFactorDisplay(input);
  } catch {
    return null;
  }
}
