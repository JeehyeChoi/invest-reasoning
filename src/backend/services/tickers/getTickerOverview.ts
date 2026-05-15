import { db } from "@/backend/config/db";
import {
  FACTOR_BLUEPRINTS,
  getFactorMetricRole,
} from "@/backend/config/factors/blueprints";

import type { TickerOverview } from "@/shared/tickers/tickerOverview";
import { resolveFactorDisplay } from "@/backend/config/factors/active";
import { isUniverseKey } from "@/shared/universe/universes";

type TickerProfileRow = {
  ticker: string;
  cik: string | null;
  company_name: string | null;
  description: string | null;
  website: string | null;
  ceo: string | null;
  ipo_date: Date | string | null;
  full_time_employees: number | string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  exchange: string | null;
  exchange_full_name: string | null;
  latest_fiscal_year: number | string | null;
	latest_annual_start: Date | string | null;
	latest_annual_end: Date | string | null;
	fiscal_year_end_month: number | string | null;
	fiscal_year_end_day: number | string | null;
  sector: string | null;
  industry: string | null;
  currency: string | null;
  is_etf: boolean | null;
  is_fund: boolean | null;
  is_adr: boolean | null;
  is_actively_trading: boolean | null;
  price: number | string | null;
  market_cap: number | string | null;
  volume: number | string | null;
  average_volume: number | string | null;
  fifty_two_week_range: string | null;
  price_change: number | string | null;
  price_change_percentage: number | string | null;
};

type FactorMetricRow = {
  factor: string;
  axis: string;
  metric_key: string;
  model_key: string | null;
  model_version: string | null;
  signal_method: string | null;
  signal_period_end: Date | string | null;
  signal_effective_date: Date | string | null;
  signal_key: string | null;
  signal_label: string | null;
  signal_value: number | string | null;
  signal_confidence: number | string | null;
  primary_feature_key: string | null;
  primary_feature_value: number | string | null;
  observed_metric_count: number | string | null;
  total_metric_count: number | string | null;
  feature_values: unknown;
  supporting_evidence: unknown;
  contradicting_evidence: unknown;
};

type FactorMetricFeatureRow = {
  factor: string;
  axis: string;
  metric_key: string;
  feature_key: string;
  feature_value: number | string | null;
  period_end: Date | string | null;
  effective_date: Date | string | null;
};

type UniverseMembershipRow = {
  universe_key: string;
};

type FactorSignalDefinitionRow = {
  factor: string;
  axis: string;
  signal_key: string;
  signal_label: string;
  signal_description: string | null;
  priority: number | string | null;
  selection_rules: unknown;
};

type FactorSignalDefinitionSummaryRow = {
  factor: string;
  axis: string;
  signal_key: string;
  priority: number | string | null;
};

type FactorSignalRow = {
  factor: string;
  axis: string;
  model_key: string | null;
  model_version: string | null;
  signal_method: string | null;
  signal_period_end: Date | string | null;
  signal_effective_date: Date | string | null;
  signal_key: string | null;
  signal_label: string | null;
  signal_value: number | string | null;
  signal_confidence: number | string | null;
  primary_metric_key: string | null;
  primary_feature_key: string | null;
  primary_feature_value: number | string | null;
  observed_metric_count: number | string | null;
  total_metric_count: number | string | null;
  feature_values: unknown;
  supporting_evidence: unknown;
  contradicting_evidence: unknown;
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
      i.cik,
			i.company_name,
			p.description,
			p.website,
			p.ceo,
			p.ipo_date,
			p.full_time_employees,
			p.city,
			p.state,
			p.zip,
      i.exchange,
      i.exchange_full_name,
			c.sector,
			c.industry,
      c.currency,
      c.is_etf,
      c.is_fund,
      c.is_adr,
      c.is_actively_trading,
      m.price,
			m.market_cap,
      m.volume,
      m.average_volume,
      m.fifty_two_week_range,
      m.price_change,
      m.price_change_percentage,
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
      ON f.cik = i.cik
		WHERE i.ticker = $1
		LIMIT 1
	`;

	const factorMetricsQuery = `
		WITH request_identity AS (
			SELECT cik
			FROM public.ticker_identities
			WHERE ticker = $1
			LIMIT 1
		)
		SELECT
			s.factor,
			s.axis,
			s.primary_metric_key AS metric_key,
			s.model_key,
			s.model_version,
			s.signal_method,
			s.signal_period_end,
			s.signal_effective_date,
			s.signal_key,
			s.signal_label,
			s.signal_value,
			s.signal_confidence,
			s.primary_feature_key,
			s.primary_feature_value,
			s.observed_metric_count,
			s.total_metric_count,
			s.feature_values,
			s.supporting_evidence,
			s.contradicting_evidence
		FROM public.ticker_factor_signals s
		WHERE (
			s.cik = (SELECT cik FROM request_identity)
			OR s.ticker = $1
		)
		  AND s.primary_metric_key IS NOT NULL
		ORDER BY s.factor, s.axis, s.primary_metric_key
  `;

  const featuresQuery = `
    WITH request_identity AS (
      SELECT cik
      FROM public.ticker_identities
      WHERE ticker = $1
      LIMIT 1
    ),
    ranked_features AS (
      SELECT
        s.factor,
        s.axis,
        s.metric_key,
        s.feature_key,
        s.feature_value,
        s.period_end,
        s.effective_date,
        row_number() OVER (
          PARTITION BY s.factor, s.axis, s.metric_key, s.feature_key
          ORDER BY s.effective_date DESC, s.period_end DESC
        ) AS feature_rank
      FROM public.ticker_factor_metric_features s
      WHERE (
        s.cik = (SELECT cik FROM request_identity)
        OR s.ticker = $1
      )
    )
    SELECT
      factor,
      axis,
      metric_key,
      feature_key,
      feature_value,
      period_end,
      effective_date
    FROM ranked_features
    WHERE feature_rank = 1
    ORDER BY factor, axis, metric_key, feature_key
  `;

  const factorSignalDefinitionsQuery = `
    SELECT
      factor,
      axis,
      signal_key,
      priority
    FROM public.ticker_factor_signal_definitions
    WHERE is_active = true
    ORDER BY factor, axis, priority, signal_key
  `;

  const universeMembershipsQuery = `
    SELECT universe_key
    FROM public.universe_memberships
    WHERE ticker = $1
      AND is_active = true
    ORDER BY universe_key
  `;

  const factorSignalsQuery = `
    WITH request_identity AS (
      SELECT cik
      FROM public.ticker_identities
      WHERE ticker = $1
      LIMIT 1
    ),
    ranked_signals AS (
      SELECT
        s.factor,
        s.axis,
        s.model_key,
        s.model_version,
        s.signal_method,
        s.signal_period_end,
        s.signal_effective_date,
        s.signal_key,
        s.signal_label,
        s.signal_value,
        s.signal_confidence,
        s.primary_metric_key,
        s.primary_feature_key,
        s.primary_feature_value,
        s.observed_metric_count,
        s.total_metric_count,
        s.feature_values,
        s.supporting_evidence,
        s.contradicting_evidence,
        row_number() OVER (
          PARTITION BY s.factor, s.axis
          ORDER BY s.signal_effective_date DESC, s.signal_period_end DESC
        ) AS signal_rank
      FROM public.ticker_factor_signals s
      WHERE (
        s.cik = (SELECT cik FROM request_identity)
        OR s.ticker = $1
      )
    )
    SELECT
      factor,
      axis,
      model_key,
      model_version,
      signal_method,
      signal_period_end,
      signal_effective_date,
      signal_key,
      signal_label,
      signal_value,
      signal_confidence,
      primary_metric_key,
      primary_feature_key,
      primary_feature_value,
      observed_metric_count,
      total_metric_count,
      feature_values,
      supporting_evidence,
      contradicting_evidence
    FROM ranked_signals
    WHERE signal_rank = 1
    ORDER BY factor, axis
  `;

  const [
    profileResult,
    factorMetricsResult,
    featuresResult,
    universeMembershipsResult,
    factorSignalDefinitionsResult,
    factorSignalsResult,
  ] =
    await Promise.all([
    db.query<TickerProfileRow>(profileQuery, [normalizedTicker]),
    db.query<FactorMetricRow>(factorMetricsQuery, [normalizedTicker]),
    db.query<FactorMetricFeatureRow>(featuresQuery, [normalizedTicker]),
    db.query<UniverseMembershipRow>(universeMembershipsQuery, [normalizedTicker]),
    db.query<FactorSignalDefinitionSummaryRow>(factorSignalDefinitionsQuery),
    db.query<FactorSignalRow>(factorSignalsQuery, [normalizedTicker]),
  ]);

  const profile = profileResult.rows[0] ?? null;

  if (!profile) {
    return null;
  }

  const availableFeatureMetricKeys = new Set(
    featuresResult.rows.map((row) =>
      buildMetricMapKey({
        factor: row.factor,
        axis: row.axis,
        metricKey: row.metric_key,
      }),
    ),
  );
  const activeFactorMetrics = buildBlueprintBackedFactorMetricRows({
    factorSignalRows: factorMetricsResult.rows,
    availableFeatureMetricKeys,
  }).filter((row) => {
    const factorBlueprint = FACTOR_BLUEPRINTS[row.factor as keyof typeof FACTOR_BLUEPRINTS];
    const axisBlueprint =
      factorBlueprint?.[row.axis as keyof typeof factorBlueprint];

    if (!axisBlueprint) {
      return false;
    }

    return axisBlueprint.metricKeys.includes(
      row.metric_key as (typeof axisBlueprint.metricKeys)[number],
    );
  });
  const featuresByMetric = groupFeaturesByMetric(featuresResult.rows);
  const signalSummariesByScope = groupSignalSummariesByScope(
    factorSignalDefinitionsResult.rows,
  );
  const factorSignals = buildFactorSignals({
    signalRows: factorSignalsResult.rows,
    signalSummariesByScope,
  });

  return {
    ticker: normalizedTicker,
		company: {
			ticker: profile.ticker,
			cik: profile.cik,
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
			exchange: profile.exchange ?? null,
			exchangeFullName: profile.exchange_full_name ?? null,
			currency: profile.currency ?? null,
			isEtf: profile.is_etf,
			isFund: profile.is_fund,
			isAdr: profile.is_adr,
			isActivelyTrading: profile.is_actively_trading,
			price: toNullableNumber(profile.price),
			marketCap: toNullableNumber(profile.market_cap),
			volume: toNullableNumber(profile.volume),
			averageVolume: toNullableNumber(profile.average_volume),
			fiftyTwoWeekRange: profile.fifty_two_week_range ?? null,
			priceChange: toNullableNumber(profile.price_change),
			priceChangePercentage: toNullableNumber(profile.price_change_percentage),
			universeMemberships: universeMembershipsResult.rows
				.map((row) => row.universe_key)
				.filter(isUniverseKey),
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
    factorSignals,
    factorMetrics: await Promise.all(
      activeFactorMetrics.map(async (row) => {
      const factor = row.factor as TickerOverview["factorMetrics"][number]["factor"];
      const axis = row.axis as TickerOverview["factorMetrics"][number]["axis"];
      const metricKey =
        row.metric_key as TickerOverview["factorMetrics"][number]["metricKey"];

			const display = await safeResolveFactorDisplay({ factor, axis, metricKey });
      const primaryFeatureValue = toNullableNumber(row.primary_feature_value);
      const features = featuresByMetric.get(
        buildMetricMapKey({ factor, axis, metricKey }),
      ) ?? [];
			return {
				factor,
				axis,
				metricKey,
        metricRole: getFactorMetricRole({ factor, axis, metricKey }),
				effectiveDate: row.signal_effective_date
          ? toIsoDate(row.signal_effective_date)
          : null,
        display,
        features: orderFeaturesForDisplay(features, display),
        missingFeatureMessage: buildMissingFeatureMessage({
          factor,
          axis,
          metricKey,
          hasFeatures: features.length > 0,
        }),
        factorInsight: {
          modelKey: row.model_key,
          modelVersion: row.model_version,
          signalMethod: row.signal_method,
          signalPeriodEnd: row.signal_period_end
            ? toIsoDate(row.signal_period_end)
            : null,
          signalEffectiveDate: row.signal_effective_date
            ? toIsoDate(row.signal_effective_date)
            : null,
          signalKey: row.signal_key,
          signalLabel: row.signal_label,
          signalValue: toNullableNumber(row.signal_value),
          signalConfidence: toNullableNumber(row.signal_confidence),
          primaryMetricKey: row.metric_key,
          primaryFeatureKey: row.primary_feature_key,
          primaryFeatureValue,
          observedMetricCount: toNullableNumber(row.observed_metric_count),
          totalMetricCount: toNullableNumber(row.total_metric_count),
          featureValues: parseFeatureValues(row.feature_values),
          candidateCount:
            signalSummariesByScope.get(buildScopeKey({ factor, axis }))
              ?.candidateCount ?? 0,
          selectedPriority: resolveSelectedPriority({
            signalKey: row.signal_key,
            summary: signalSummariesByScope.get(buildScopeKey({ factor, axis })),
          }),
          candidates: [],
          supportingEvidence: parseSignalEvidence(row.supporting_evidence),
          contradictingEvidence: parseSignalEvidence(row.contradicting_evidence),
        },
				};
    })),
  };
}

function buildMissingFeatureMessage(input: {
  factor: string;
  axis: string;
  metricKey: string;
  hasFeatures: boolean;
}): string | null {
  if (input.hasFeatures) return null;

  if (
    input.factor === "income" &&
    input.axis === "fundamentals_based" &&
    input.metricKey === "operating_cash_flow"
  ) {
    return "Derived series needed: dividend_payments";
  }

  if (
    (input.factor === "growth" || input.factor === "quality") &&
    input.axis === "fundamentals_based" &&
    input.metricKey === "gross_profit"
  ) {
    return "Derived series may be needed: gross_profit";
  }

  return null;
}

function buildBlueprintBackedFactorMetricRows(input: {
  factorSignalRows: FactorMetricRow[];
  availableFeatureMetricKeys: Set<string>;
}): FactorMetricRow[] {
  const rowsByKey = new Map<string, FactorMetricRow>();
  const orderedRows: FactorMetricRow[] = [];
  const orderedKeys = new Set<string>();

  for (const row of input.factorSignalRows) {
    rowsByKey.set(buildMetricMapKey({
      factor: row.factor,
      axis: row.axis,
      metricKey: row.metric_key,
    }), row);
  }

  for (const [factor, factorBlueprint] of Object.entries(FACTOR_BLUEPRINTS)) {
    if (!factorBlueprint) continue;

    for (const [axis, axisBlueprint] of Object.entries(factorBlueprint)) {
      for (const metricKey of axisBlueprint.metricKeys) {
        const key = buildMetricMapKey({ factor, axis, metricKey });
        const factorSignalRow = rowsByKey.get(key);

        if (factorSignalRow) {
          orderedRows.push(factorSignalRow);
          orderedKeys.add(key);
          continue;
        }

        const hasFeatureRows = input.availableFeatureMetricKeys.has(key);

        if (!hasFeatureRows) continue;

        orderedRows.push(buildEmptyFactorMetricRow({ factor, axis, metricKey }));
        orderedKeys.add(key);
      }
    }
  }

  for (const [key, row] of rowsByKey) {
    if (!orderedKeys.has(key)) {
      orderedRows.push(row);
    }
  }

  return orderedRows;
}

function buildEmptyFactorMetricRow(input: {
  factor: string;
  axis: string;
  metricKey: string;
}): FactorMetricRow {
  return {
	    factor: input.factor,
	    axis: input.axis,
	    metric_key: input.metricKey,
    model_key: null,
    model_version: null,
    signal_method: null,
    signal_period_end: null,
	    signal_effective_date: null,
    signal_key: null,
    signal_label: null,
    signal_value: null,
    signal_confidence: null,
    primary_feature_key: null,
    primary_feature_value: null,
    observed_metric_count: null,
    total_metric_count: null,
    feature_values: null,
    supporting_evidence: null,
    contradicting_evidence: null,
  };
}

function buildFactorSignals(input: {
  signalRows: FactorSignalRow[];
  signalSummariesByScope: Map<string, SignalSummary>;
}): TickerOverview["factorSignals"] {
  const rowsByScope = new Map<string, FactorSignalRow>();

  for (const row of input.signalRows) {
    rowsByScope.set(buildScopeKey({ factor: row.factor, axis: row.axis }), row);
  }

  return Array.from(input.signalSummariesByScope.entries())
    .map(([scopeKey, summary]) => {
      const [factor, axis] = scopeKey.split(":");
      const row = rowsByScope.get(scopeKey);

      return {
        factor: factor as TickerOverview["factorSignals"][number]["factor"],
        axis: axis as TickerOverview["factorSignals"][number]["axis"],
        ...buildFactorInsightFromSignalRow(row, summary),
      };
    })
    .sort((a, b) => a.factor.localeCompare(b.factor));
}

type SignalSummary = {
  candidateCount: number;
  prioritiesBySignalKey: Map<string, number | null>;
};

function buildFactorInsightFromSignalRow(
  row: FactorSignalRow | undefined,
  summary: SignalSummary,
): NonNullable<TickerOverview["factorMetrics"][number]["factorInsight"]> {
  return {
    modelKey: row?.model_key ?? null,
    modelVersion: row?.model_version ?? null,
    signalMethod: row?.signal_method ?? null,
    signalPeriodEnd: row?.signal_period_end ? toIsoDate(row.signal_period_end) : null,
    signalEffectiveDate: row?.signal_effective_date
      ? toIsoDate(row.signal_effective_date)
      : null,
    signalKey: row?.signal_key ?? null,
    signalLabel: row?.signal_label ?? null,
    signalValue: toNullableNumber(row?.signal_value),
    signalConfidence: toNullableNumber(row?.signal_confidence),
    primaryMetricKey: row?.primary_metric_key ?? null,
    primaryFeatureKey: row?.primary_feature_key ?? null,
    primaryFeatureValue: toNullableNumber(row?.primary_feature_value),
    observedMetricCount: toNullableNumber(row?.observed_metric_count),
    totalMetricCount: toNullableNumber(row?.total_metric_count),
    featureValues: parseFeatureValues(row?.feature_values),
    candidateCount: summary.candidateCount,
    selectedPriority: resolveSelectedPriority({
      signalKey: row?.signal_key ?? null,
      summary,
    }),
    candidates: [],
    supportingEvidence: [],
    contradictingEvidence: [],
  };
}

function groupFeaturesByMetric(
  rows: FactorMetricFeatureRow[],
): Map<string, NonNullable<TickerOverview["factorMetrics"][number]["features"]>> {
  const grouped = new Map<
    string,
    NonNullable<TickerOverview["factorMetrics"][number]["features"]>
  >();

  for (const row of rows) {
    const metricKey = buildMetricMapKey({
      factor: row.factor,
      axis: row.axis,
      metricKey: row.metric_key,
    });
    const metricFeatures = grouped.get(metricKey) ?? [];

    metricFeatures.push({
      featureKey: row.feature_key,
      featureLabel: formatFeatureLabel(row.feature_key),
      featureValue: toNullableNumber(row.feature_value),
      periodEnd: row.period_end ? toIsoDate(row.period_end) : null,
      effectiveDate: row.effective_date ? toIsoDate(row.effective_date) : null,
    });
    grouped.set(metricKey, metricFeatures);
  }

  return grouped;
}

function orderFeaturesForDisplay(
  features: NonNullable<TickerOverview["factorMetrics"][number]["features"]>,
  display: TickerOverview["factorMetrics"][number]["display"],
): NonNullable<TickerOverview["factorMetrics"][number]["features"]> {
  const featureOrder = display?.metricOrder ?? [];
  const featureLabels = display?.metricLabels ?? {};

  return [...features]
    .map((feature) => ({
      ...feature,
      featureLabel: featureLabels[feature.featureKey] ?? feature.featureLabel,
    }))
    .sort((a, b) => {
      const aIndex = featureOrder.indexOf(a.featureKey);
      const bIndex = featureOrder.indexOf(b.featureKey);

      if (aIndex !== -1 || bIndex !== -1) {
        if (aIndex === -1) return 1;
        if (bIndex === -1) return -1;
        return aIndex - bIndex;
      }

      return a.featureKey.localeCompare(b.featureKey);
    });
}

function buildMetricMapKey(input: {
  factor: string;
  axis: string;
  metricKey: string;
}): string {
  return `${input.factor}:${input.axis}:${input.metricKey}`;
}

function buildScopeKey(input: { factor: string; axis: string }): string {
  return `${input.factor}:${input.axis}`;
}

function groupSignalSummariesByScope(
  rows: FactorSignalDefinitionSummaryRow[],
): Map<string, SignalSummary> {
  const grouped = new Map<string, SignalSummary>();

  for (const row of rows) {
    const key = buildScopeKey({ factor: row.factor, axis: row.axis });
    const summary = grouped.get(key) ?? {
      candidateCount: 0,
      prioritiesBySignalKey: new Map<string, number | null>(),
    };

    summary.candidateCount += 1;
    summary.prioritiesBySignalKey.set(row.signal_key, toNullableNumber(row.priority));
    grouped.set(key, summary);
  }

  return grouped;
}

function resolveSelectedPriority(input: {
  signalKey: string | null | undefined;
  summary: SignalSummary | undefined;
}): number | null {
  if (!input.signalKey || !input.summary) return null;
  return input.summary.prioritiesBySignalKey.get(input.signalKey) ?? null;
}

function summarizeSelectionRules(value: unknown): string {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return "-";
  }

  const rules = value as {
    default?: unknown;
    all?: unknown;
    any?: unknown;
  };

  if (rules.default === true) {
    return "Default fallback";
  }

  const parts = [
    ...summarizeRuleConditions("All", rules.all),
    ...summarizeRuleConditions("Any", rules.any),
  ];

  return parts.length > 0 ? parts.join(" | ") : "-";
}

function summarizeRuleConditions(label: string, value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((condition) => {
    if (!condition || typeof condition !== "object" || Array.isArray(condition)) {
      return [];
    }

    const raw = condition as Record<string, unknown>;
    const featureKey =
      typeof raw.featureKey === "string" ? formatFeatureLabel(raw.featureKey) : null;
    const operator = typeof raw.operator === "string" ? raw.operator : null;
    const conditionValue = toNullableNumber(raw.value);
    const minObservedMetricCount = toNullableNumber(raw.minObservedMetricCount);

    if (!featureKey || !operator || conditionValue === null) {
      return [];
    }

    return [
      `${label}: ${featureKey} ${operator} ${formatRuleNumber(conditionValue)}${
        minObservedMetricCount !== null
          ? `, min metrics ${minObservedMetricCount}`
          : ""
      }`,
    ];
  });
}

function formatRuleNumber(value: number): string {
  if (Math.abs(value) <= 5) {
    return `${(value * 100).toFixed(1)}%`;
  }

  return value.toFixed(2);
}

function formatFeatureLabel(featureKey: string): string {
  return featureKey
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
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

function parseFeatureValues(
  value: unknown,
): NonNullable<TickerOverview["factorMetrics"][number]["factorInsight"]>["featureValues"] {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value).flatMap(([key, entry]) => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
        return [];
      }

      const raw = entry as Record<string, unknown>;
      const featureValue = toNullableNumber(raw.value);
      const observedMetricCount = toNullableNumber(raw.observedMetricCount);

      if (featureValue === null || observedMetricCount === null) {
        return [];
      }

      return [
        [
          key,
          {
            value: featureValue,
            observedMetricCount,
          },
        ],
      ];
    }),
  );
}

function parseSignalEvidence(
  value: unknown,
): NonNullable<TickerOverview["factorMetrics"][number]["factorInsight"]>["supportingEvidence"] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      return [];
    }

    const raw = item as Record<string, unknown>;
    const featureValue = toNullableNumber(raw.featureValue);

    if (
      typeof raw.metricKey !== "string" ||
      typeof raw.featureKey !== "string" ||
      typeof raw.periodEnd !== "string" ||
      typeof raw.effectiveDate !== "string" ||
      featureValue === null
    ) {
      return [];
    }

    return [
      {
        metricKey: raw.metricKey,
        featureKey: raw.featureKey,
        featureValue,
        periodEnd: raw.periodEnd,
        effectiveDate: raw.effectiveDate,
      },
    ];
  });
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
