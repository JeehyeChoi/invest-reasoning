import { db } from "@/backend/config/db";
import { requireDateKey } from "@/backend/services/sec/companyFacts/series/utils/dateKey";
import type { FactorAxisKey } from "@/shared/factors/axes";
import type { FactorKey } from "@/shared/factors/factors";
import { normalizeTickers } from "@/shared/tickers/utils";

type BuildTickerFactorSignalsInput = {
  factor?: FactorKey;
  axis?: FactorAxisKey;
  asOfDate?: string;
  tickers?: string[];
};

type ResolvedBuildTickerFactorSignalsInput = Required<
  Pick<BuildTickerFactorSignalsInput, "factor" | "axis">
> &
  BuildTickerFactorSignalsInput;

type SignalDefinitionRow = {
  model_key: string;
  model_version: string;
  factor: FactorKey;
  axis: FactorAxisKey;
  signal_key: string;
  signal_label: string;
  priority: number | string;
  selection_rules: SignalSelectionRules;
  evidence_rules: SignalEvidenceRules;
  confidence_rules: SignalConfidenceRules;
};

type SignalSelectionRules = {
  default?: boolean;
  all?: SignalSelectionCondition[];
  any?: SignalSelectionCondition[];
};

type SignalSelectionCondition = {
  featureKey: string;
  aggregate?: "latest_median";
  operator: ">=" | ">" | "<=" | "<" | "=";
  value: number;
  minObservedMetricCount?: number;
};

type SignalEvidenceRules = {
  supportingFeatureKeys?: string[];
  contradictingFeatureKeys?: string[];
  contextFeatureKeys?: string[];
  maxPresentedItems?: number;
};

type SignalConfidenceRules = {
  minObservedMetricCount?: number;
  fullConfidenceMetricCount?: number;
};

type LatestFeatureRow = {
  ticker: string;
  cik: string | null;
  factor: FactorKey;
  axis: FactorAxisKey;
  metric_key: string;
  feature_key: string;
  feature_value: number | string;
  period_end: Date | string;
  effective_date: Date | string;
  source_table: string | null;
  source_version: string | null;
};

type FeatureAggregate = {
  featureKey: string;
  value: number;
  observedMetricCount: number;
  evidenceRows: LatestFeatureRow[];
};

type SelectionMatch = {
  matchedFeatureKey: string | null;
};

type FactorFeatureGroup = {
  ticker: string;
  cik: string | null;
  factor: FactorKey;
  axis: FactorAxisKey;
  features: LatestFeatureRow[];
};

type BuiltSignalRow = {
  ticker: string;
  cik: string | null;
  factor: FactorKey;
  axis: FactorAxisKey;
  model_key: string;
  model_version: string;
  signal_key: string;
  signal_label: string;
  signal_value: number | null;
  signal_method: string;
  signal_confidence: number | null;
  signal_period_end: string;
  signal_effective_date: string;
  latest_growth_value: number | null;
  durable_growth_value: number | null;
  consistency_value: number | null;
  acceleration_value: number | null;
  trend_deviation_value: number | null;
  turnaround_momentum_value: number | null;
  shock_absorption_value: number | null;
  primary_metric_key: string | null;
  primary_feature_key: string | null;
  primary_feature_value: number | null;
  observed_metric_count: number;
  total_metric_count: number;
  feature_values: Record<
    string,
    { value: number; observedMetricCount: number }
  >;
  supporting_evidence: SignalEvidenceItem[];
  contradicting_evidence: SignalEvidenceItem[];
  source_table: string | null;
  source_version: string | null;
};

type SignalEvidenceItem = {
  metricKey: string;
  featureKey: string;
  featureValue: number;
  periodEnd: string;
  effectiveDate: string;
};

export async function buildTickerFactorSignals(
  input: BuildTickerFactorSignalsInput = {},
): Promise<void> {
  const resolvedInput = resolveBuildTickerFactorSignalsInput(input);
  if (resolvedInput.tickers?.length === 0) return;

  const params = buildTickerFactorSignalQueryParams(resolvedInput);

  const [definitions, features] = await Promise.all([
    loadSignalDefinitions(params),
    loadLatestFeatures(params),
  ]);

  const definitionsByScope = groupDefinitionsByScope(definitions);
  const rows = Array.from(groupLatestFeatures(features).values())
    .map((group) =>
      buildSignalRowFromFeatureGroup({
        group,
        definitions:
          definitionsByScope.get(buildScopeKey(group.factor, group.axis)) ?? [],
        asOfDate: resolvedInput.asOfDate,
      }),
    )
    .filter((row): row is BuiltSignalRow => row !== null);

  await db.query(
    `
    DELETE FROM public.ticker_factor_signals
    WHERE factor = $1
      AND axis = $2
      AND model_key = 'factor_signal'
      AND model_version = 'v0'
      AND ($3::date IS NULL OR signal_effective_date = $3::date)
      AND ($4::text[] IS NULL OR ticker = ANY($4::text[]))
    `,
    params,
  );

  await upsertSignalRows(rows);
}

async function loadSignalDefinitions(
  params: unknown[],
): Promise<SignalDefinitionRow[]> {
  const result = await db.query<SignalDefinitionRow>(
    `
    SELECT
      model_key,
      model_version,
      factor,
      axis,
      signal_key,
      signal_label,
      priority,
      selection_rules,
      evidence_rules,
      confidence_rules
    FROM public.ticker_factor_signal_definitions
    WHERE factor = $1
      AND axis = $2
      AND model_key = 'factor_signal'
      AND model_version = 'v0'
      AND is_active = true
    ORDER BY priority ASC, signal_key ASC
    `,
    params.slice(0, 2),
  );

  return result.rows;
}

async function loadLatestFeatures(params: unknown[]): Promise<LatestFeatureRow[]> {
  const result = await db.query<LatestFeatureRow>(
    `
    SELECT DISTINCT ON (
      COALESCE(cik, ticker),
      factor,
      axis,
      metric_key,
      feature_key
    )
      ticker,
      cik,
      factor,
      axis,
      metric_key,
      feature_key,
      feature_value,
      period_end,
      effective_date,
      source_table,
      source_version
    FROM public.ticker_factor_metric_features
    WHERE factor = $1
      AND axis = $2
      AND ($3::date IS NULL OR effective_date <= $3::date)
      AND ($4::text[] IS NULL OR ticker = ANY($4::text[]))
      AND feature_value IS NOT NULL
    ORDER BY
      COALESCE(cik, ticker),
      factor,
      axis,
      metric_key,
      feature_key,
      effective_date DESC,
      period_end DESC,
      ticker ASC
    `,
    params,
  );

  return result.rows;
}

function resolveBuildTickerFactorSignalsInput(
  input: BuildTickerFactorSignalsInput = {},
): ResolvedBuildTickerFactorSignalsInput {
  return {
    ...input,
    factor: input.factor ?? "growth",
    axis: input.axis ?? "fundamentals_based",
    tickers: input.tickers ? normalizeTickers(input.tickers) : undefined,
  };
}

function buildTickerFactorSignalQueryParams(
  input: ResolvedBuildTickerFactorSignalsInput,
): unknown[] {
  return [input.factor, input.axis, input.asOfDate ?? null, input.tickers ?? null];
}

function groupDefinitionsByScope(
  definitions: SignalDefinitionRow[],
): Map<string, SignalDefinitionRow[]> {
  const grouped = new Map<string, SignalDefinitionRow[]>();

  for (const definition of definitions) {
    const key = buildScopeKey(definition.factor, definition.axis);
    grouped.set(key, [...(grouped.get(key) ?? []), definition]);
  }

  return grouped;
}

function groupLatestFeatures(
  features: LatestFeatureRow[],
): Map<string, FactorFeatureGroup> {
  const grouped = new Map<string, FactorFeatureGroup>();

  for (const feature of features) {
    const key = [
      feature.cik ?? feature.ticker,
      feature.factor,
      feature.axis,
    ].join(":");
    const group =
      grouped.get(key) ??
      ({
        ticker: feature.ticker,
        cik: feature.cik,
        factor: feature.factor,
        axis: feature.axis,
        features: [],
      } satisfies FactorFeatureGroup);

    group.features.push(feature);
    grouped.set(key, group);
  }

  return grouped;
}

function buildSignalRowFromFeatureGroup(input: {
  group: FactorFeatureGroup;
  definitions: SignalDefinitionRow[];
  asOfDate?: string;
}): BuiltSignalRow | null {
  if (input.definitions.length === 0 || input.group.features.length === 0) {
    return null;
  }

  const aggregates = buildFeatureAggregates(input.group.features);
  const matchedDefinition = input.definitions.flatMap((candidate) => {
    const selectionMatch = matchSelectionRules(
      candidate.selection_rules,
      aggregates,
    );

    return selectionMatch ? [{ definition: candidate, selectionMatch }] : [];
  })[0];

  if (!matchedDefinition) return null;

  const { definition, selectionMatch } = matchedDefinition;

  const supportingEvidence = buildEvidenceItems({
    aggregates,
    featureKeys: [
      ...(definition.evidence_rules.supportingFeatureKeys ?? []),
      ...(definition.evidence_rules.contextFeatureKeys ?? []),
    ],
    maxPresentedItems: definition.evidence_rules.maxPresentedItems ?? 5,
  });
  const contradictingEvidence = buildEvidenceItems({
    aggregates,
    featureKeys: definition.evidence_rules.contradictingFeatureKeys ?? [],
    maxPresentedItems: definition.evidence_rules.maxPresentedItems ?? 5,
  });
  const primaryAggregate = resolvePrimaryAggregate({
    definition,
    aggregates,
    supportingEvidence,
    selectionMatch,
  });
  const primaryEvidence =
    supportingEvidence.find(
      (evidence) => evidence.featureKey === primaryAggregate?.featureKey,
    ) ??
    supportingEvidence[0] ??
    null;
  const signalValue = primaryAggregate?.value ?? primaryEvidence?.featureValue ?? null;
  const latestFeature = input.group.features.reduce((current, candidate) =>
    compareFeatureDate(candidate, current) > 0 ? candidate : current,
  );
  const observedMetricCount = primaryAggregate?.observedMetricCount ?? 0;
  const totalMetricCount = new Set(
    input.group.features.map((feature) => feature.metric_key),
  ).size;

  return {
    ticker: input.group.ticker,
    cik: input.group.cik,
    factor: input.group.factor,
    axis: input.group.axis,
    model_key: definition.model_key,
    model_version: definition.model_version,
    signal_key: definition.signal_key,
    signal_label: definition.signal_label,
    signal_value: signalValue,
    signal_method: "definition_latest_feature_aggregate",
    signal_confidence: calcSignalConfidence({
      observedMetricCount,
      rules: definition.confidence_rules,
    }),
    signal_period_end: requireDateKey(latestFeature.period_end),
    signal_effective_date: input.asOfDate ?? requireDateKey(latestFeature.effective_date),
    latest_growth_value: resolveFeatureBucketValue(aggregates, [
      "latestGrowth",
      "capexInvestmentIntensityChange",
      "dividendMomentum",
      "energyActivityGrowth",
      "energyAssetInventoryGrowth",
      "energyCostPressure",
      "receivablesChange",
      "inventoryChange",
      "payablesChange",
      "priceReturn3M",
      "priceReturn6M",
      "priceReturn12M",
      "priceMomentum12MEx1M",
      "relativeReturn3M",
      "relativeReturn6M",
      "relativeReturn12M",
      "relativeMomentum12MEx1M",
      "defensiveBurdenRelief",
      "assetBaseGrowth",
      "bookEquityGrowth",
      "dilutedTtmEpsGrowth",
      "basicTtmEpsGrowth",
      "dividendYield",
      "buybackYield",
      "shareholderYield",
      "dividendYieldShare",
      "buybackYieldShare",
    ]),
    durable_growth_value: resolveFeatureBucketValue(aggregates, [
      "durableGrowth",
    ]),
    consistency_value: resolveFeatureBucketValue(aggregates, [
      "profitabilityConsistency",
      "dividendConsistency",
      "defensiveStability",
      "defensiveBurdenContractionConsistency",
    ]),
    acceleration_value: resolveFeatureBucketValue(aggregates, [
      "yoyGrowthAcceleration",
      "capexCycleAcceleration",
      "energyActivityAcceleration",
      "energyAssetInventoryAcceleration",
      "energyCostAcceleration",
    ]),
    trend_deviation_value: resolveFeatureBucketValue(aggregates, [
      "profitabilityPosition",
      "capexCycleQuarterStretch",
      "capexCycleAnnualStretch",
      "dividendPosition",
      "energyActivityStretch",
      "energyAssetInventoryStretch",
      "energyCostStretch",
      "receivablesBuild",
      "inventoryBuild",
      "payablesBuild",
      "receivablesToRevenue",
      "inventoryToRevenue",
      "payablesToRevenue",
      "distanceFrom52WeekHigh",
      "realizedVolatility1Y",
      "realizedVolatility3Y",
      "downsideVolatility1Y",
      "maxDrawdown1Y",
      "marketBeta1Y",
      "marketBeta3Y",
      "correlationToMarket3Y",
      "upsideCapture1Y",
      "downsideCapture1Y",
      "qqqBeta1Y",
      "qqqBeta3Y",
      "qqqCorrelation3Y",
      "diaBeta1Y",
      "diaBeta3Y",
      "diaCorrelation3Y",
      "defensiveBufferPosition",
      "defensiveBurdenTrendRelief",
      "bookEquityToAssets",
      "bookEquityPosition",
      "retainedEarningsToAssets",
      "cashToAssets",
      "liabilitiesToAssets",
      "debtToAssets",
      "assetBasePosition",
      "priceToDilutedTtmEps",
      "priceToBasicTtmEps",
      "priceToBook",
      "priceToSales",
      "priceToEarnings",
      "priceToOperatingCashFlow",
      "freeCashFlowYield",
      "enterpriseValueToSales",
      "marketCapitalization",
      "logMarketCapitalization",
    ]),
    turnaround_momentum_value: resolveFeatureBucketValue(aggregates, [
      "turnaroundMomentum",
      "profitabilityTurnaround",
    ]),
    shock_absorption_value: resolveFeatureBucketValue(aggregates, [
      "defensiveShockAbsorption",
    ]),
    primary_metric_key: primaryEvidence?.metricKey ?? null,
    primary_feature_key: primaryEvidence?.featureKey ?? primaryAggregate?.featureKey ?? null,
    primary_feature_value: primaryEvidence?.featureValue ?? signalValue,
    observed_metric_count: observedMetricCount,
    total_metric_count: totalMetricCount,
    feature_values: Object.fromEntries(
      Array.from(aggregates.entries()).map(([key, aggregate]) => [
        key,
        {
          value: aggregate.value,
          observedMetricCount: aggregate.observedMetricCount,
        },
      ]),
    ),
    supporting_evidence: supportingEvidence,
    contradicting_evidence: contradictingEvidence,
    source_table: latestFeature.source_table,
    source_version: latestFeature.source_version,
  };
}

function buildFeatureAggregates(
  features: LatestFeatureRow[],
): Map<string, FeatureAggregate> {
  const grouped = new Map<string, LatestFeatureRow[]>();

  for (const feature of features) {
    grouped.set(feature.feature_key, [
      ...(grouped.get(feature.feature_key) ?? []),
      feature,
    ]);
  }

  return new Map(
    Array.from(grouped.entries()).flatMap(([featureKey, rows]) => {
      const numericRows = rows.filter((row) =>
        Number.isFinite(Number(row.feature_value)),
      );

      if (numericRows.length === 0) return [];

      return [
        [
          featureKey,
          {
            featureKey,
            value: median(numericRows.map((row) => Number(row.feature_value))),
            observedMetricCount: new Set(
              numericRows.map((row) => row.metric_key),
            ).size,
            evidenceRows: numericRows,
          },
        ] satisfies [string, FeatureAggregate],
      ];
    }),
  );
}

function matchSelectionRules(
  rules: SignalSelectionRules,
  aggregates: Map<string, FeatureAggregate>,
): SelectionMatch | null {
  if (rules.default) {
    return aggregates.size > 0 ? { matchedFeatureKey: null } : null;
  }

  const all = rules.all ?? [];
  const any = rules.any ?? [];
  const matchedAll = all.flatMap((condition) =>
    matchesCondition(condition, aggregates) ? [condition] : [],
  );
  const matchedAny = any.find((condition) => matchesCondition(condition, aggregates));

  if (all.length > 0 && matchedAll.length !== all.length) return null;
  if (any.length > 0 && !matchedAny) return null;

  return {
    matchedFeatureKey:
      matchedAny?.featureKey ?? matchedAll[0]?.featureKey ?? null,
  };
}

function matchesCondition(
  condition: SignalSelectionCondition,
  aggregates: Map<string, FeatureAggregate>,
): boolean {
  const aggregate = aggregates.get(condition.featureKey);
  if (!aggregate) return false;

  if (
    aggregate.observedMetricCount <
    (condition.minObservedMetricCount ?? 1)
  ) {
    return false;
  }

  return compareNumber({
    left: aggregate.value,
    operator: condition.operator,
    right: condition.value,
  });
}

function compareNumber(input: {
  left: number;
  operator: SignalSelectionCondition["operator"];
  right: number;
}): boolean {
  if (input.operator === ">=") return input.left >= input.right;
  if (input.operator === ">") return input.left > input.right;
  if (input.operator === "<=") return input.left <= input.right;
  if (input.operator === "<") return input.left < input.right;
  return input.left === input.right;
}

function buildEvidenceItems(input: {
  aggregates: Map<string, FeatureAggregate>;
  featureKeys: string[];
  maxPresentedItems: number;
}): SignalEvidenceItem[] {
  const itemsByFeatureKey = input.featureKeys.map((featureKey) => {
    const aggregate = input.aggregates.get(featureKey);

    return {
      featureKey,
      items: aggregate
        ? aggregate.evidenceRows.map((row) => ({
        metricKey: row.metric_key,
        featureKey: row.feature_key,
        featureValue: Number(row.feature_value),
        periodEnd: requireDateKey(row.period_end),
        effectiveDate: requireDateKey(row.effective_date),
      })).sort((a, b) => Math.abs(b.featureValue) - Math.abs(a.featureValue))
        : [],
    };
  });

  const output: SignalEvidenceItem[] = [];
  let rowIndex = 0;

  while (output.length < input.maxPresentedItems) {
    let added = false;

    for (const feature of itemsByFeatureKey) {
      const item = feature.items[rowIndex];
      if (!item) continue;

      output.push(item);
      added = true;

      if (output.length >= input.maxPresentedItems) break;
    }

    if (!added) break;
    rowIndex += 1;
  }

  return output;
}

function resolvePrimaryAggregate(input: {
  definition: SignalDefinitionRow;
  aggregates: Map<string, FeatureAggregate>;
  supportingEvidence: SignalEvidenceItem[];
  selectionMatch: SelectionMatch;
}): FeatureAggregate | null {
  const firstRuleFeatureKey =
    input.selectionMatch.matchedFeatureKey ??
    input.definition.selection_rules.all?.[0]?.featureKey ??
    input.definition.selection_rules.any?.[0]?.featureKey ??
    input.supportingEvidence[0]?.featureKey;

  if (!firstRuleFeatureKey) return null;
  return input.aggregates.get(firstRuleFeatureKey) ?? null;
}

function resolveFeatureBucketValue(
  aggregates: Map<string, FeatureAggregate>,
  featureKeys: string[],
): number | null {
  const values = featureKeys.flatMap((featureKey) => {
    const aggregate = aggregates.get(featureKey);
    return aggregate ? [aggregate.value] : [];
  });

  return values.length > 0 ? median(values) : null;
}

function calcSignalConfidence(input: {
  observedMetricCount: number;
  rules: SignalConfidenceRules;
}): number | null {
  const minObserved = input.rules.minObservedMetricCount ?? 1;
  const fullConfidence = input.rules.fullConfidenceMetricCount ?? minObserved;

  if (input.observedMetricCount < minObserved) return null;
  if (fullConfidence <= 0) return null;

  return Math.min(1, input.observedMetricCount / fullConfidence);
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 1) return sorted[middle] ?? 0;

  return ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
}

function compareFeatureDate(a: LatestFeatureRow, b: LatestFeatureRow): number {
  const aEffective = requireDateKey(a.effective_date);
  const bEffective = requireDateKey(b.effective_date);

  if (aEffective !== bEffective) {
    return aEffective > bEffective ? 1 : -1;
  }

  const aPeriodEnd = requireDateKey(a.period_end);
  const bPeriodEnd = requireDateKey(b.period_end);

  if (aPeriodEnd === bPeriodEnd) return 0;
  return aPeriodEnd > bPeriodEnd ? 1 : -1;
}

async function upsertSignalRows(rows: BuiltSignalRow[]): Promise<void> {
  if (rows.length === 0) return;

  const values: unknown[] = [];
  const placeholders = rows.map((row, index) => {
    const offset = index * 30;

    values.push(
      row.ticker,
      row.cik,
      row.factor,
      row.axis,
      row.model_key,
      row.model_version,
      row.signal_key,
      row.signal_label,
      row.signal_value,
      row.signal_method,
      row.signal_confidence,
      row.signal_period_end,
      row.signal_effective_date,
      row.latest_growth_value,
      row.durable_growth_value,
      row.consistency_value,
      row.acceleration_value,
      row.trend_deviation_value,
      row.turnaround_momentum_value,
      row.shock_absorption_value,
      row.primary_metric_key,
      row.primary_feature_key,
      row.primary_feature_value,
      row.observed_metric_count,
      row.total_metric_count,
      JSON.stringify(row.feature_values),
      JSON.stringify(row.supporting_evidence),
      JSON.stringify(row.contradicting_evidence),
      row.source_table,
      row.source_version,
    );

    const rowPlaceholders = Array.from({ length: 30 }, (_, i) => {
      const parameterIndex = offset + i + 1;

      if (i === 25 || i === 26 || i === 27) {
        return `$${parameterIndex}::jsonb`;
      }

      return `$${parameterIndex}`;
    });

    return `(${rowPlaceholders.join(",")})`;
  });

  await db.query(
    `
    INSERT INTO public.ticker_factor_signals (
      ticker,
      cik,
      factor,
      axis,
      model_key,
      model_version,
      signal_key,
      signal_label,
      signal_value,
      signal_method,
      signal_confidence,
      signal_period_end,
      signal_effective_date,
      latest_growth_value,
      durable_growth_value,
      consistency_value,
      acceleration_value,
      trend_deviation_value,
      turnaround_momentum_value,
      shock_absorption_value,
      primary_metric_key,
      primary_feature_key,
      primary_feature_value,
      observed_metric_count,
      total_metric_count,
      feature_values,
      supporting_evidence,
      contradicting_evidence,
      source_table,
      source_version
    )
    VALUES ${placeholders.join(",")}
    ON CONFLICT (
      ticker,
      factor,
      axis,
      model_key,
      model_version,
      signal_effective_date
    )
    DO UPDATE SET
      cik = EXCLUDED.cik,
      signal_key = EXCLUDED.signal_key,
      signal_label = EXCLUDED.signal_label,
      signal_value = EXCLUDED.signal_value,
      signal_method = EXCLUDED.signal_method,
      signal_confidence = EXCLUDED.signal_confidence,
      signal_period_end = EXCLUDED.signal_period_end,
      latest_growth_value = EXCLUDED.latest_growth_value,
      durable_growth_value = EXCLUDED.durable_growth_value,
      consistency_value = EXCLUDED.consistency_value,
      acceleration_value = EXCLUDED.acceleration_value,
      trend_deviation_value = EXCLUDED.trend_deviation_value,
      turnaround_momentum_value = EXCLUDED.turnaround_momentum_value,
      shock_absorption_value = EXCLUDED.shock_absorption_value,
      primary_metric_key = EXCLUDED.primary_metric_key,
      primary_feature_key = EXCLUDED.primary_feature_key,
      primary_feature_value = EXCLUDED.primary_feature_value,
      observed_metric_count = EXCLUDED.observed_metric_count,
      total_metric_count = EXCLUDED.total_metric_count,
      feature_values = EXCLUDED.feature_values,
      supporting_evidence = EXCLUDED.supporting_evidence,
      contradicting_evidence = EXCLUDED.contradicting_evidence,
      source_table = EXCLUDED.source_table,
      source_version = EXCLUDED.source_version,
      updated_at = now()
    `,
    values,
  );
}

function buildScopeKey(factor: FactorKey, axis: FactorAxisKey): string {
  return `${factor}:${axis}`;
}
