import { db } from "@/backend/config/db";
import { parseSignalClusteringQuestionPolicies } from "@/backend/services/signal-clustering/parseSignalClusteringQuestionPolicy";
import type { FactorAxisKey } from "@/shared/factors/axes";
import type { FactorKey } from "@/shared/factors/factors";
import type { SignalClusteringQuestionPolicy } from "@/shared/market/signalClusteringPolicy";
import { DEFAULT_UNIVERSE_KEYS, type UniverseKey } from "@/shared/universe/universes";

type SignalValidationInput = {
  factor?: FactorKey;
  axis?: FactorAxisKey;
  asOfDate?: string;
  universeKeys?: UniverseKey[];
};

type SignalDefinitionRow = {
  factor: FactorKey;
  axis: FactorAxisKey;
  signal_key: string;
  signal_label: string | null;
  priority: number | string;
  selection_rules: SignalSelectionRules;
};

type SignalSelectionRules = {
  default?: boolean;
  all?: SignalSelectionCondition[];
  any?: SignalSelectionCondition[];
};

type SignalSelectionCondition = {
  featureKey: string;
  operator: ">=" | ">" | "<=" | "<" | "=";
  value: number;
  minObservedMetricCount?: number;
};

type LatestSignalRow = {
  ticker: string;
  sector: string | null;
  factor: FactorKey;
  axis: FactorAxisKey;
  signal_key: string;
  signal_label: string | null;
  priority: number | string | null;
  selection_rules: SignalSelectionRules | null;
  primary_feature_key: string | null;
  primary_feature_value: number | string | null;
  signal_value: number | string | null;
  observed_metric_count: number | string | null;
  total_metric_count: number | string | null;
  feature_values: Record<string, FeatureValue> | null;
  universe_keys: string[] | null;
};

type FeatureValue = {
  value?: number | string | null;
  observedMetricCount?: number | string | null;
};

type ScopeTotalRow = {
  factor: FactorKey;
  axis: FactorAxisKey;
  total_count: number | string;
};

type AxisPolicyRow = {
  factor: FactorKey;
  axis: FactorAxisKey;
  status: string | null;
  reason: string | null;
};

export type FactorSignalValidationReport = {
  asOfDate: string | null;
  universeKeys: UniverseKey[];
  generatedAt: string;
  totals: {
    factorAxisCount: number;
    selectedSignalCount: number;
    universeTickerCount: number;
    mixedCount: number;
    noSignalCount: number;
  };
  questionPolicies: SignalClusteringQuestionPolicy[];
  rows: FactorSignalValidationRow[];
};

export type FactorSignalValidationRow = {
  factor: FactorKey;
  axis: FactorAxisKey;
  signalKey: string;
  signalLabel: string;
  priority: number;
  count: number;
  share: number | null;
  mixedShare: number | null;
  noSignalShare: number | null;
  medianDriver: number | null;
  p10Driver: number | null;
  p90Driver: number | null;
  avgAllMatched: number | null;
  avgAllTotal: number | null;
  avgAnyMatched: number | null;
  avgAnyTotal: number | null;
  minMetricsMetShare: number | null;
  shadowedCandidateCount: number;
  topSector: string | null;
  topSectorShare: number | null;
  universeCounts: Record<string, number>;
  examples: {
    representative: string[];
    threshold: string[];
    outliers: string[];
  };
};

type RowAccumulator = {
  definition: SignalDefinitionRow;
  count: number;
  mixedCount: number;
  driverValues: Array<{ ticker: string; value: number }>;
  allMatchedSum: number;
  allTotalSum: number;
  anyMatchedSum: number;
  anyTotalSum: number;
  minMetricsMetCount: number;
  shadowedCandidateCount: number;
  sectorCounts: Map<string, number>;
  universeCounts: Map<string, number>;
  thresholdDistances: Array<{ ticker: string; distance: number }>;
};

export async function getFactorSignalValidationReport(
  input: SignalValidationInput = {},
): Promise<FactorSignalValidationReport> {
  const universeKeys = input.universeKeys?.length
    ? input.universeKeys
    : DEFAULT_UNIVERSE_KEYS;
  const params = [
    input.factor ?? null,
    input.axis ?? null,
    input.asOfDate ?? null,
    universeKeys,
  ];

  const [
    definitionResult,
    signalResult,
    scopeTotalResult,
    universeTotalResult,
    axisPolicyResult,
  ] =
    await Promise.all([
      db.query<SignalDefinitionRow>(
        `
        SELECT
          factor,
          axis,
          signal_key,
          signal_label,
          priority,
          selection_rules
        FROM public.ticker_factor_signal_definitions
        WHERE model_key = 'factor_signal'
          AND model_version = 'v0'
          AND is_active = true
          AND ($1::text IS NULL OR factor = $1::text)
          AND ($2::text IS NULL OR axis = $2::text)
        ORDER BY factor ASC, axis ASC, priority ASC, signal_key ASC
        `,
        params.slice(0, 2),
      ),
      db.query<LatestSignalRow>(
        `
        WITH scoped_universe AS (
          SELECT
            ticker,
            max(sector) FILTER (WHERE sector IS NOT NULL AND sector <> '') AS sector,
            array_agg(DISTINCT universe_key ORDER BY universe_key) AS universe_keys
          FROM public.universe_memberships
          WHERE universe_key = ANY($4::text[])
            AND is_active = true
          GROUP BY ticker
        ),
        latest_signals AS (
          SELECT DISTINCT ON (s.ticker, s.factor, s.axis)
            s.ticker,
            COALESCE(NULLIF(u.sector, ''), NULLIF(c.sector, '')) AS sector,
            s.factor,
            s.axis,
            s.signal_key,
            s.signal_label,
            d.priority,
            d.selection_rules,
            s.primary_feature_key,
            s.primary_feature_value,
            s.signal_value,
            s.observed_metric_count,
            s.total_metric_count,
            s.feature_values,
            u.universe_keys
          FROM public.ticker_factor_signals s
          JOIN scoped_universe u ON u.ticker = s.ticker
          LEFT JOIN public.ticker_company_classifications c ON c.ticker = s.ticker
          LEFT JOIN public.ticker_factor_signal_definitions d
            ON d.model_key = s.model_key
           AND d.model_version = s.model_version
           AND d.factor = s.factor
           AND d.axis = s.axis
           AND d.signal_key = s.signal_key
          WHERE s.model_key = 'factor_signal'
            AND s.model_version = 'v0'
            AND ($1::text IS NULL OR s.factor = $1::text)
            AND ($2::text IS NULL OR s.axis = $2::text)
            AND ($3::date IS NULL OR s.signal_effective_date <= $3::date)
          ORDER BY
            s.ticker,
            s.factor,
            s.axis,
            s.signal_effective_date DESC,
            s.signal_period_end DESC
        )
        SELECT * FROM latest_signals
        `,
        params,
      ),
      db.query<ScopeTotalRow>(
        `
        WITH scoped_universe AS (
          SELECT DISTINCT ticker
          FROM public.universe_memberships
          WHERE universe_key = ANY($3::text[])
            AND is_active = true
        ),
        scopes AS (
          SELECT DISTINCT factor, axis
          FROM public.ticker_factor_signal_definitions
          WHERE model_key = 'factor_signal'
            AND model_version = 'v0'
            AND is_active = true
            AND ($1::text IS NULL OR factor = $1::text)
            AND ($2::text IS NULL OR axis = $2::text)
        )
        SELECT
          scopes.factor,
          scopes.axis,
          count(scoped_universe.ticker) AS total_count
        FROM scopes
        CROSS JOIN scoped_universe
        GROUP BY scopes.factor, scopes.axis
        `,
        [input.factor ?? null, input.axis ?? null, universeKeys],
      ),
      db.query<{ total_count: number | string }>(
        `
        SELECT count(DISTINCT ticker) AS total_count
        FROM public.universe_memberships
        WHERE universe_key = ANY($1::text[])
          AND is_active = true
        `,
        [universeKeys],
      ),
      loadQuestionPolicyRows({
        factor: input.factor,
        axis: input.axis,
      }),
    ]);

  const definitionsByScope = groupDefinitionsByScope(definitionResult.rows);
  const scopeTotals = new Map(
    scopeTotalResult.rows.map((row) => [
      buildScopeKey(row.factor, row.axis),
      Number(row.total_count),
    ]),
  );
  const accumulators = new Map<string, RowAccumulator>();

  for (const definition of definitionResult.rows) {
    accumulators.set(buildRowKey(definition), {
      definition,
      count: 0,
      mixedCount: 0,
      driverValues: [],
      allMatchedSum: 0,
      allTotalSum: 0,
      anyMatchedSum: 0,
      anyTotalSum: 0,
      minMetricsMetCount: 0,
      shadowedCandidateCount: 0,
      sectorCounts: new Map(),
      universeCounts: new Map(),
      thresholdDistances: [],
    });
  }

  let mixedCount = 0;

  for (const row of signalResult.rows) {
    const scopeDefinitions =
      definitionsByScope.get(buildScopeKey(row.factor, row.axis)) ?? [];
    const selectedDefinition =
      scopeDefinitions.find((definition) => definition.signal_key === row.signal_key) ??
      buildDefinitionFromSignalRow(row);
    const accumulator = accumulators.get(buildRowKey(selectedDefinition));

    if (!accumulator) continue;

    const featureValues = row.feature_values ?? {};
    const coverage = evaluateRules(selectedDefinition.selection_rules, featureValues);
    const driverValue = getDriverValue(row);
    const isMixed = isMixedDefinition(selectedDefinition);

    accumulator.count += 1;
    accumulator.mixedCount += isMixed ? 1 : 0;
    accumulator.allMatchedSum += coverage.allMatched;
    accumulator.allTotalSum += coverage.allTotal;
    accumulator.anyMatchedSum += coverage.anyMatched;
    accumulator.anyTotalSum += coverage.anyTotal;
    accumulator.minMetricsMetCount += coverage.minMetricsMet ? 1 : 0;
    accumulator.shadowedCandidateCount += countShadowedCandidates({
      definitions: scopeDefinitions,
      selectedDefinition,
      featureValues,
    });

    if (isMixed) mixedCount += 1;

    if (driverValue !== null) {
      accumulator.driverValues.push({ ticker: row.ticker, value: driverValue });
    }

    if (row.sector) {
      increment(accumulator.sectorCounts, row.sector);
    }

    for (const universeKey of row.universe_keys ?? []) {
      increment(accumulator.universeCounts, universeKey);
    }

    const thresholdDistance = getNearestThresholdDistance({
      rules: selectedDefinition.selection_rules,
      featureValues,
    });

    if (thresholdDistance !== null) {
      accumulator.thresholdDistances.push({
        ticker: row.ticker,
        distance: thresholdDistance,
      });
    }
  }

  const rows = Array.from(accumulators.values())
    .map((accumulator) =>
      buildValidationRow({
        accumulator,
        scopeTotal:
          scopeTotals.get(
            buildScopeKey(accumulator.definition.factor, accumulator.definition.axis),
          ) ?? 0,
      }),
    )
    .sort((a, b) => {
      if (a.factor !== b.factor) return a.factor.localeCompare(b.factor);
      if (a.axis !== b.axis) return a.axis.localeCompare(b.axis);
      return a.priority - b.priority || a.signalKey.localeCompare(b.signalKey);
    });

  const universeTickerCount = Number(
    universeTotalResult.rows[0]?.total_count ?? 0,
  );
  const factorAxisUniverseTotal = Array.from(scopeTotals.values()).reduce(
    (sum, value) => sum + value,
    0,
  );
  const selectedSignalCount = signalResult.rows.length;

  return {
    asOfDate: input.asOfDate ?? null,
    universeKeys,
    generatedAt: new Date().toISOString(),
    totals: {
      factorAxisCount: scopeTotals.size,
      selectedSignalCount,
      universeTickerCount,
      mixedCount,
      noSignalCount: Math.max(0, factorAxisUniverseTotal - selectedSignalCount),
    },
    questionPolicies: buildQuestionPolicies(axisPolicyResult.rows),
    rows,
  };
}

function buildQuestionPolicies(
  rows: AxisPolicyRow[],
): SignalClusteringQuestionPolicy[] {
  return parseSignalClusteringQuestionPolicies(
    rows.map((row) => ({
      factor: row.factor,
      axis: row.axis,
      status: row.status,
      reason: row.reason,
    })),
  );
}

async function loadQuestionPolicyRows(input: {
  factor?: FactorKey;
  axis?: FactorAxisKey;
}): Promise<{ rows: AxisPolicyRow[] }> {
  try {
    return await db.query<AxisPolicyRow>(
      `
      SELECT
        factor,
        axis,
        status,
        reason
      FROM public.ticker_signal_clustering_question_policies
      WHERE model_key = 'factor_signal'
        AND model_version = 'v0'
        AND is_active = true
        AND ($1::text IS NULL OR factor = $1::text)
        AND ($2::text IS NULL OR axis = $2::text)
      ORDER BY factor ASC, axis ASC
      `,
      [input.factor ?? null, input.axis ?? null],
    );
  } catch (error) {
    if (isUndefinedTableError(error)) return { rows: [] };
    throw error;
  }
}

function buildValidationRow(input: {
  accumulator: RowAccumulator;
  scopeTotal: number;
}): FactorSignalValidationRow {
  const { accumulator, scopeTotal } = input;
  const count = accumulator.count;
  const sortedDriverValues = accumulator.driverValues
    .map((item) => item.value)
    .sort((a, b) => a - b);
  const topSector = getTopEntry(accumulator.sectorCounts);
  const representative = getRepresentativeExamples(accumulator.driverValues);
  const outliers = [...accumulator.driverValues]
    .sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
    .slice(0, 5)
    .map((item) => item.ticker);
  const threshold = [...accumulator.thresholdDistances]
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 5)
    .map((item) => item.ticker);

  return {
    factor: accumulator.definition.factor,
    axis: accumulator.definition.axis,
    signalKey: accumulator.definition.signal_key,
    signalLabel: accumulator.definition.signal_label ?? accumulator.definition.signal_key,
    priority: Number(accumulator.definition.priority),
    count,
    share: scopeTotal > 0 ? count / scopeTotal : null,
    mixedShare: count > 0 ? accumulator.mixedCount / count : null,
    noSignalShare: scopeTotal > 0 ? Math.max(0, scopeTotal - count) / scopeTotal : null,
    medianDriver: percentile(sortedDriverValues, 0.5),
    p10Driver: percentile(sortedDriverValues, 0.1),
    p90Driver: percentile(sortedDriverValues, 0.9),
    avgAllMatched: count > 0 ? accumulator.allMatchedSum / count : null,
    avgAllTotal: count > 0 ? accumulator.allTotalSum / count : null,
    avgAnyMatched: count > 0 ? accumulator.anyMatchedSum / count : null,
    avgAnyTotal: count > 0 ? accumulator.anyTotalSum / count : null,
    minMetricsMetShare: count > 0 ? accumulator.minMetricsMetCount / count : null,
    shadowedCandidateCount: accumulator.shadowedCandidateCount,
    topSector: topSector?.key ?? null,
    topSectorShare: topSector && count > 0 ? topSector.value / count : null,
    universeCounts: Object.fromEntries(accumulator.universeCounts),
    examples: {
      representative,
      threshold,
      outliers,
    },
  };
}

function evaluateRules(
  rules: SignalSelectionRules,
  featureValues: Record<string, FeatureValue>,
) {
  const all = rules.all ?? [];
  const any = rules.any ?? [];
  const conditions = [...all, ...any];
  const allMatched = all.filter((condition) =>
    matchesCondition(condition, featureValues),
  ).length;
  const anyMatched = any.filter((condition) =>
    matchesCondition(condition, featureValues),
  ).length;

  return {
    allMatched,
    allTotal: all.length,
    anyMatched,
    anyTotal: any.length,
    minMetricsMet:
      conditions.length === 0 ||
      conditions.every((condition) => hasMinObservedMetrics(condition, featureValues)),
  };
}

function countShadowedCandidates(input: {
  definitions: SignalDefinitionRow[];
  selectedDefinition: SignalDefinitionRow;
  featureValues: Record<string, FeatureValue>;
}) {
  const selectedPriority = Number(input.selectedDefinition.priority);

  return input.definitions.filter((definition) => {
    if (definition.signal_key === input.selectedDefinition.signal_key) return false;
    if (Number(definition.priority) <= selectedPriority) return false;
    if (definition.selection_rules.default) return false;

    return rulesMatch(definition.selection_rules, input.featureValues);
  }).length;
}

function rulesMatch(
  rules: SignalSelectionRules,
  featureValues: Record<string, FeatureValue>,
) {
  if (rules.default) return Object.keys(featureValues).length > 0;

  const all = rules.all ?? [];
  const any = rules.any ?? [];

  if (all.length > 0 && !all.every((condition) => matchesCondition(condition, featureValues))) {
    return false;
  }

  if (any.length > 0 && !any.some((condition) => matchesCondition(condition, featureValues))) {
    return false;
  }

  return all.length > 0 || any.length > 0;
}

function matchesCondition(
  condition: SignalSelectionCondition,
  featureValues: Record<string, FeatureValue>,
) {
  if (!hasMinObservedMetrics(condition, featureValues)) return false;

  const value = getFeatureNumber(condition.featureKey, featureValues);
  if (value === null) return false;

  if (condition.operator === ">=") return value >= condition.value;
  if (condition.operator === ">") return value > condition.value;
  if (condition.operator === "<=") return value <= condition.value;
  if (condition.operator === "<") return value < condition.value;
  return value === condition.value;
}

function hasMinObservedMetrics(
  condition: SignalSelectionCondition,
  featureValues: Record<string, FeatureValue>,
) {
  const observedMetricCount = Number(
    featureValues[condition.featureKey]?.observedMetricCount ?? 0,
  );

  return observedMetricCount >= (condition.minObservedMetricCount ?? 1);
}

function getNearestThresholdDistance(input: {
  rules: SignalSelectionRules;
  featureValues: Record<string, FeatureValue>;
}) {
  const distances = [...(input.rules.all ?? []), ...(input.rules.any ?? [])].flatMap(
    (condition) => {
      const value = getFeatureNumber(condition.featureKey, input.featureValues);
      if (value === null) return [];
      const denominator = Math.max(Math.abs(condition.value), 1);

      return [Math.abs(value - condition.value) / denominator];
    },
  );

  if (distances.length === 0) return null;

  return Math.min(...distances);
}

function getFeatureNumber(
  featureKey: string,
  featureValues: Record<string, FeatureValue>,
) {
  const value = Number(featureValues[featureKey]?.value);

  return Number.isFinite(value) ? value : null;
}

function getDriverValue(row: LatestSignalRow) {
  const primaryValue = Number(row.primary_feature_value);
  if (Number.isFinite(primaryValue)) return primaryValue;

  const signalValue = Number(row.signal_value);
  return Number.isFinite(signalValue) ? signalValue : null;
}

function getRepresentativeExamples(items: Array<{ ticker: string; value: number }>) {
  if (items.length === 0) return [];

  const medianValue = percentile(
    items.map((item) => item.value).sort((a, b) => a - b),
    0.5,
  );

  if (medianValue === null) return [];

  return [...items]
    .sort((a, b) => Math.abs(a.value - medianValue) - Math.abs(b.value - medianValue))
    .slice(0, 5)
    .map((item) => item.ticker);
}

function percentile(values: number[], p: number) {
  if (values.length === 0) return null;
  if (values.length === 1) return values[0] ?? null;

  const index = (values.length - 1) * p;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index - lower;
  const lowerValue = values[lower] ?? 0;
  const upperValue = values[upper] ?? lowerValue;

  return lowerValue + (upperValue - lowerValue) * weight;
}

function getTopEntry(map: Map<string, number>) {
  return [...map.entries()]
    .map(([key, value]) => ({ key, value }))
    .sort((a, b) => b.value - a.value || a.key.localeCompare(b.key))[0] ?? null;
}

function groupDefinitionsByScope(definitions: SignalDefinitionRow[]) {
  const grouped = new Map<string, SignalDefinitionRow[]>();

  for (const definition of definitions) {
    const key = buildScopeKey(definition.factor, definition.axis);
    grouped.set(key, [...(grouped.get(key) ?? []), definition]);
  }

  return grouped;
}

function buildDefinitionFromSignalRow(row: LatestSignalRow): SignalDefinitionRow {
  return {
    factor: row.factor,
    axis: row.axis,
    signal_key: row.signal_key,
    signal_label: row.signal_label,
    priority: row.priority ?? 999,
    selection_rules: row.selection_rules ?? {},
  };
}

function isMixedDefinition(definition: SignalDefinitionRow) {
  return (
    Boolean(definition.selection_rules.default) ||
    definition.signal_key.toLowerCase().includes("mixed")
  );
}

function increment(map: Map<string, number>, key: string) {
  map.set(key, (map.get(key) ?? 0) + 1);
}

function buildScopeKey(factor: FactorKey, axis: FactorAxisKey) {
  return `${factor}:${axis}`;
}

function buildRowKey(definition: SignalDefinitionRow) {
  return `${buildScopeKey(definition.factor, definition.axis)}:${definition.signal_key}`;
}

function isUndefinedTableError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "42P01"
  );
}
