import { db } from "@/backend/config/db";
import type { FactorKey } from "@/shared/factors/factors";
import type { FactorAxisKey } from "@/shared/factors/axes";
import { resolveMetricFeatureInterpretation } from "@/backend/services/sec/companyFacts/series/feature/resolveMetricFeatureInterpretation";
import { loadCompanyMetricSignProfiles } from "@/backend/services/sec/companyFacts/series/fiscal/loadCompanyMetricSignProfiles";
import { requireDateKey } from "@/backend/services/sec/companyFacts/series/utils/dateKey";
import type { PoolClient } from "pg";
import type {
  CompanyMetricSignProfile,
  CompanyMetricSignProfileKind,
} from "@/backend/services/sec/companyFacts/series/fiscal/types";
import type {
  EnrichedMetricSeriesSignalRow,
  MetricFeatureDefinition,
  MetricFeatureInterpretationConfig,
  MetricFeatureMetricKey,
  MetricFeatureSeriesSource,
  MetricFeatureSourceKey,
  TickerFactorMetricFeatureRow,
} from "@/backend/services/sec/companyFacts/series/feature/types";

type BuildInput = {
  ticker: string;
  cik: string;
  factor?: FactorKey;
  axis?: FactorAxisKey;
  metricKey: MetricFeatureMetricKey;
  asOfDate?: string;
};

type ResolvedSignalSeriesSource = Required<
  Pick<MetricFeatureSeriesSource, "table" | "version" | "metricKey" | "periodType">
> & {
  processKey?: string;
};

type LoadedSignalSeries = {
  source: ResolvedSignalSeriesSource;
  rows: EnrichedMetricSeriesSignalRow[];
  macroRows?: MacroObservationRow[];
  denominatorSource?: ResolvedSignalSeriesSource;
  denominatorRows?: EnrichedMetricSeriesSignalRow[];
  counterpartSource?: ResolvedSignalSeriesSource;
  counterpartRows?: EnrichedMetricSeriesSignalRow[];
};

type SignProfileIndex = Map<string, CompanyMetricSignProfile>;

type MacroObservationRow = {
  observation_date: Date | string;
  value: number | string | null;
};

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function getSourceValue(
  row: EnrichedMetricSeriesSignalRow | null,
  source: MetricFeatureSourceKey | undefined,
): number | boolean | null {
  if (!row || !source) return null;
  return row[source] ?? null;
}

function toSignalNumber(value: number | boolean | null): number | null {
  if (typeof value === "boolean") return value ? 1 : 0;
  return isFiniteNumber(value) ? value : null;
}

function calcRelativeDeviation(
  value: number | boolean | null,
  reference: number | boolean | null,
): number | null {
  const numericValue = toSignalNumber(value);
  const numericReference = toSignalNumber(reference);

  if (
    numericValue === null ||
    numericReference === null ||
    numericReference === 0
  ) {
    return null;
  }

  return (numericValue - numericReference) / Math.abs(numericReference);
}

function calcPositiveRatio(
  rows: EnrichedMetricSeriesSignalRow[],
  source: MetricFeatureSourceKey | undefined,
): number | null {
  if (!source || rows.length === 0) return null;

  let observed = 0;
  let positive = 0;

  for (const row of rows) {
    const value = toSignalNumber(getSourceValue(row, source));
    if (value === null) continue;

    observed += 1;
    if (value > 0) positive += 1;
  }

  if (observed === 0) return null;
  return positive / observed;
}

function calcNegativeRatio(
  rows: EnrichedMetricSeriesSignalRow[],
  source: MetricFeatureSourceKey | undefined,
): number | null {
  if (!source || rows.length === 0) return null;

  let observed = 0;
  let negative = 0;

  for (const row of rows) {
    const value = toSignalNumber(getSourceValue(row, source));
    if (value === null) continue;

    observed += 1;
    if (value < 0) negative += 1;
  }

  if (observed === 0) return null;
  return negative / observed;
}

function calcValidRatio(
  rows: EnrichedMetricSeriesSignalRow[],
  source: MetricFeatureSourceKey | undefined,
): number | null {
  if (!source || rows.length === 0) return null;

  let observed = 0;

  for (const row of rows) {
    const value = toSignalNumber(getSourceValue(row, source));
    if (value !== null) observed += 1;
  }

  return observed / rows.length;
}

function calcProfitabilityShift(
  row: EnrichedMetricSeriesSignalRow,
  definition: MetricFeatureDefinition,
): number | null {
  const turnaround = toSignalNumber(
    getSourceValue(row, definition.sources?.turnaround),
  );
  const lossNarrowing = toSignalNumber(
    getSourceValue(row, definition.sources?.lossNarrowing),
  );
  const deterioration = toSignalNumber(
    getSourceValue(row, definition.sources?.deterioration),
  );

  if (turnaround === 1) return 1;
  if (lossNarrowing === 1) return 0.5;
  if (deterioration === 1) return -1;

  if (
    turnaround === null &&
    lossNarrowing === null &&
    deterioration === null
  ) {
    return null;
  }

  return 0;
}

function findLatestDenominatorRow(input: {
  rows: EnrichedMetricSeriesSignalRow[] | undefined;
  currentEnd: Date | string;
}): EnrichedMetricSeriesSignalRow | null {
  if (!input.rows || input.rows.length === 0) return null;

  const currentEnd = requireDateKey(input.currentEnd);
  let latest: EnrichedMetricSeriesSignalRow | null = null;

  for (const row of input.rows) {
    const rowEnd = requireDateKey(row.end);
    if (rowEnd > currentEnd) break;
    latest = row;
  }

  return latest;
}

function calcRatioToDenominator(input: {
  row: EnrichedMetricSeriesSignalRow;
  definition: MetricFeatureDefinition;
  denominatorRows?: EnrichedMetricSeriesSignalRow[];
}): number | null {
  const numerator = toSignalNumber(
    getSourceValue(input.row, input.definition.source),
  );
  const denominatorRow = findLatestDenominatorRow({
    rows: input.denominatorRows,
    currentEnd: input.row.end,
  });
  const denominator = toSignalNumber(
    getSourceValue(denominatorRow, input.definition.denominator?.source),
  );

  if (numerator === null || denominator === null || denominator === 0) {
    return null;
  }

  return numerator / Math.abs(denominator);
}

function calcSpreadToDenominator(input: {
  row: EnrichedMetricSeriesSignalRow;
  definition: MetricFeatureDefinition;
  counterpartRows?: EnrichedMetricSeriesSignalRow[];
  denominatorRows?: EnrichedMetricSeriesSignalRow[];
}): number | null {
  const source = toSignalNumber(
    getSourceValue(input.row, input.definition.source),
  );
  const counterpartRow = findLatestDenominatorRow({
    rows: input.counterpartRows,
    currentEnd: input.row.end,
  });
  const counterpart = toSignalNumber(
    getSourceValue(counterpartRow, input.definition.counterpart?.source),
  );
  const denominatorRow = findLatestDenominatorRow({
    rows: input.denominatorRows,
    currentEnd: input.row.end,
  });
  const denominator = toSignalNumber(
    getSourceValue(denominatorRow, input.definition.denominator?.source),
  );

  if (
    source === null ||
    counterpart === null ||
    denominator === null ||
    denominator === 0
  ) {
    return null;
  }

  return (source - counterpart) / Math.abs(denominator);
}

function calcRatioDeviation(
  value: number | boolean | null,
  reference: number | boolean | null,
): number | null {
  const numericValue = toSignalNumber(value);
  const numericReference = toSignalNumber(reference);

  if (
    numericValue === null ||
    numericReference === null ||
    numericReference === 0
  ) {
    return null;
  }

  return numericValue / numericReference - 1;
}

function calcLagRatioDeviation(input: {
  rows: EnrichedMetricSeriesSignalRow[];
  currentIndex: number;
  definition: MetricFeatureDefinition;
}): number | null {
  const lookback = input.definition.lookback ?? 4;
  const current = input.rows[input.currentIndex];
  const reference = input.rows[input.currentIndex - lookback];

  if (!current || !reference) return null;

  return calcRatioDeviation(
    getSourceValue(current, input.definition.source),
    getSourceValue(reference, input.definition.source),
  );
}

function calcMacroSensitivityBeta(input: {
  rows: EnrichedMetricSeriesSignalRow[];
  currentIndex: number;
  definition: MetricFeatureDefinition;
  macroRows?: MacroObservationRow[];
}): number | null {
  if (!input.definition.macroSource || !input.macroRows?.length) return null;

  const lookback = input.definition.lookback ?? 20;
  const minObservations = input.definition.minObservations ?? 12;
  const valueScale = input.definition.macroSource.valueScale ?? 1;
  const window = input.rows.slice(
    Math.max(0, input.currentIndex - lookback + 1),
    input.currentIndex + 1,
  );
  const pairs = window.flatMap((row) => {
    const companyValue = toSignalNumber(
      getSourceValue(row, input.definition.source),
    );
    const macroRow = findLatestMacroRow({
      rows: input.macroRows,
      currentEnd: row.end,
    });
    const macroValue =
      macroRow?.value === null || macroRow?.value === undefined
        ? null
        : Number(macroRow.value) * valueScale;

    if (
      companyValue === null ||
      macroValue === null ||
      !Number.isFinite(macroValue)
    ) {
      return [];
    }

    return [{ company: companyValue, macro: macroValue }];
  });

  if (pairs.length < minObservations) return null;

  const macroValues = pairs.map((pair) => pair.macro);
  const variance = sampleVariance(macroValues);
  if (variance === null || variance === 0) return null;

  return covariance(
    pairs.map((pair) => pair.company),
    macroValues,
  ) / variance;
}

function findLatestMacroRow(input: {
  rows: MacroObservationRow[] | undefined;
  currentEnd: Date | string;
}): MacroObservationRow | null {
  if (!input.rows || input.rows.length === 0) return null;

  const currentEnd = requireDateKey(input.currentEnd);
  let latest: MacroObservationRow | null = null;

  for (const row of input.rows) {
    const rowEnd = requireDateKey(row.observation_date);
    if (rowEnd > currentEnd) break;
    latest = row;
  }

  return latest;
}

function sampleVariance(values: number[]): number | null {
  if (values.length < 2) return null;

  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const sumSquares = values.reduce(
    (sum, value) => sum + (value - mean) ** 2,
    0,
  );

  return sumSquares / (values.length - 1);
}

function covariance(left: number[], right: number[]): number {
  const length = Math.min(left.length, right.length);
  const leftMean =
    left.slice(0, length).reduce((sum, value) => sum + value, 0) / length;
  const rightMean =
    right.slice(0, length).reduce((sum, value) => sum + value, 0) / length;
  let sum = 0;

  for (let index = 0; index < length; index += 1) {
    sum += ((left[index] ?? 0) - leftMean) * ((right[index] ?? 0) - rightMean);
  }

  return sum / (length - 1);
}

function calcSignalValue(input: {
  rows: EnrichedMetricSeriesSignalRow[];
  currentIndex: number;
  definition: MetricFeatureDefinition;
  denominatorRows?: EnrichedMetricSeriesSignalRow[];
  counterpartRows?: EnrichedMetricSeriesSignalRow[];
  macroRows?: MacroObservationRow[];
}): number | null {
  const current = input.rows[input.currentIndex];
  const method = input.definition.method ?? "direct";

  if (!current) return null;

  if (method === "positive_ratio") {
    const lookback = input.definition.lookback ?? 4;
    const window = input.rows.slice(
      Math.max(0, input.currentIndex - lookback + 1),
      input.currentIndex + 1,
    );

    if (window.length < lookback) return null;
    return calcPositiveRatio(window, input.definition.source);
  }

  if (method === "negative_ratio") {
    const lookback = input.definition.lookback ?? 4;
    const window = input.rows.slice(
      Math.max(0, input.currentIndex - lookback + 1),
      input.currentIndex + 1,
    );

    if (window.length < lookback) return null;
    return calcNegativeRatio(window, input.definition.source);
  }

  if (method === "valid_ratio") {
    const lookback = input.definition.lookback ?? 4;
    const window = input.rows.slice(
      Math.max(0, input.currentIndex - lookback + 1),
      input.currentIndex + 1,
    );

    if (window.length < lookback) return null;
    return calcValidRatio(window, input.definition.source);
  }

  if (method === "ratio_to_denominator") {
    return calcRatioToDenominator({
      row: current,
      definition: input.definition,
      denominatorRows: input.denominatorRows,
    });
  }

  if (method === "spread_to_denominator") {
    return calcSpreadToDenominator({
      row: current,
      definition: input.definition,
      counterpartRows: input.counterpartRows,
      denominatorRows: input.denominatorRows,
    });
  }

  if (method === "ratio_deviation") {
    return calcRatioDeviation(
      getSourceValue(current, input.definition.source),
      getSourceValue(current, input.definition.reference),
    );
  }

  if (method === "lag_ratio_deviation") {
    return calcLagRatioDeviation(input);
  }

  if (method === "macro_sensitivity_beta") {
    return calcMacroSensitivityBeta(input);
  }

  if (method === "relative_deviation") {
    return calcRelativeDeviation(
      getSourceValue(current, input.definition.source),
      getSourceValue(current, input.definition.reference),
    );
  }

  if (method === "negative_relative_deviation") {
    const value = calcRelativeDeviation(
      getSourceValue(current, input.definition.source),
      getSourceValue(current, input.definition.reference),
    );

    return value === null ? null : -value;
  }

  if (method === "turnaround_momentum" || input.definition.sources) {
    return calcProfitabilityShift(current, input.definition);
  }

  const value = toSignalNumber(getSourceValue(current, input.definition.source));

  if (method === "negative_direct") {
    return value === null ? null : -value;
  }

  return value;
}

function normalizeBySignProfile(input: {
  value: number | null;
  row: EnrichedMetricSeriesSignalRow;
  definition: MetricFeatureDefinition;
  signProfileIndex: SignProfileIndex;
}): number | null {
  const policy = input.definition.signProfilePolicy;
  if (!policy || input.value === null) return input.value;

  const profile = resolveSignProfile({
    row: input.row,
    signProfileIndex: input.signProfileIndex,
  });

  if (!profile) return null;
  if (profile.confidence < (policy.minConfidence ?? 0)) return null;

  const action = actionForSignProfile({
    signProfile: profile.signProfile,
    definition: input.definition,
  });

  if (action === "invert") return -input.value;
  if (action === "use") return input.value;
  return null;
}

function actionForSignProfile(input: {
  signProfile: CompanyMetricSignProfileKind;
  definition: MetricFeatureDefinition;
}) {
  const policy = input.definition.signProfilePolicy;
  if (!policy) return "use";

  switch (input.signProfile) {
    case "negative_dominant":
      return policy.negativeDominant;
    case "positive_dominant":
      return policy.positiveDominant ?? "null";
    case "mixed":
      return policy.mixed ?? "null";
    case "zero_or_sparse":
      return policy.zeroOrSparse ?? "null";
    case "unknown":
      return policy.unknown ?? "null";
    default:
      return "null";
  }
}

function resolveSignProfile(input: {
  row: EnrichedMetricSeriesSignalRow;
  signProfileIndex: SignProfileIndex;
}): CompanyMetricSignProfile | null {
  if (!input.row.source_tag) return null;

  return (
    input.signProfileIndex.get(
      signProfileKey({
        metricKey: input.row.metric_key,
        tag: input.row.source_tag,
        unit: input.row.unit,
      }),
    ) ?? null
  );
}

function buildSignProfileIndex(
  profiles: CompanyMetricSignProfile[],
): SignProfileIndex {
  const index: SignProfileIndex = new Map();

  for (const profile of profiles) {
    index.set(
      signProfileKey({
        metricKey: profile.metricKey,
        tag: profile.tag,
        unit: profile.unit,
      }),
      profile,
    );
  }

  return index;
}

function signProfileKey(input: {
  metricKey: string;
  tag: string;
  unit: string;
}): string {
  return [input.metricKey, input.tag, input.unit].join("|");
}

function buildSignalRows(input: {
  ticker: string;
  cik: string;
  config: MetricFeatureInterpretationConfig;
  seriesBySignalKey: Map<string, LoadedSignalSeries>;
  signProfileIndex: SignProfileIndex;
}): TickerFactorMetricFeatureRow[] {
  const output: TickerFactorMetricFeatureRow[] = [];

  for (const [featureKey, definition] of Object.entries(input.config.features)) {
    const loadedSeries = input.seriesBySignalKey.get(featureKey);
    if (!loadedSeries) continue;

    for (let index = 0; index < loadedSeries.rows.length; index += 1) {
      const row = loadedSeries.rows[index];
      const rawFeatureValue = calcSignalValue({
        rows: loadedSeries.rows,
        currentIndex: index,
        definition,
        denominatorRows: loadedSeries.denominatorRows,
        counterpartRows: loadedSeries.counterpartRows,
        macroRows: loadedSeries.macroRows,
      });
      const featureValue = normalizeBySignProfile({
        value: rawFeatureValue,
        row,
        definition,
        signProfileIndex: input.signProfileIndex,
      });

      if (featureValue === null) continue;

      output.push({
        ticker: row.ticker ?? input.ticker,
        cik: input.cik,
        factor: input.config.factor,
        axis: input.config.axis,
        metric_key: input.config.metricKey,
        feature_key: featureKey,
        feature_value: featureValue,
        period_end: requireDateKey(row.end),
        effective_date: requireDateKey(row.effective_date ?? row.end),
        source_table: loadedSeries.source.table,
        source_version: loadedSeries.source.version,
      });
    }
  }

  return output;
}

function resolveSignalSeriesSource(input: {
  config: MetricFeatureInterpretationConfig;
  definition: MetricFeatureDefinition;
}): ResolvedSignalSeriesSource {
  const series = input.definition.series;

  if (!series) {
    throw new Error(
      `Missing signal series source for ${input.config.factor}/${input.config.axis}/${input.config.metricKey}`,
    );
  }

  return {
    table: series.table,
    version: series.version,
    processKey: series.processKey,
    metricKey: series.metricKey ?? input.config.metricKey,
    periodType: series.periodType,
  };
}

function resolveDenominatorSeriesSource(input: {
  config: MetricFeatureInterpretationConfig;
  definition: MetricFeatureDefinition;
}): ResolvedSignalSeriesSource | null {
  const denominator = input.definition.denominator;
  if (!denominator) return null;

  return {
    table: denominator.table,
    version: denominator.version,
    processKey: denominator.processKey,
    metricKey: denominator.metricKey ?? input.config.metricKey,
    periodType: denominator.periodType,
  };
}

function resolveCounterpartSeriesSource(input: {
  config: MetricFeatureInterpretationConfig;
  definition: MetricFeatureDefinition;
}): ResolvedSignalSeriesSource | null {
  const counterpart = input.definition.counterpart;
  if (!counterpart) return null;

  return {
    table: counterpart.table,
    version: counterpart.version,
    processKey: counterpart.processKey,
    metricKey: counterpart.metricKey ?? input.config.metricKey,
    periodType: counterpart.periodType,
  };
}

async function loadSignalSeriesBySignalKey(input: {
  cik: string;
  config: MetricFeatureInterpretationConfig;
  asOfDate?: string;
}): Promise<Map<string, LoadedSignalSeries>> {
  const rowsBySource = new Map<string, EnrichedMetricSeriesSignalRow[]>();
  const seriesBySignalKey = new Map<string, LoadedSignalSeries>();

  for (const [featureKey, definition] of Object.entries(input.config.features)) {
    const source = resolveSignalSeriesSource({
      config: input.config,
      definition,
    });
    const sourceKey = [
      source.table,
      source.version,
      source.processKey ?? "",
      source.metricKey,
      source.periodType,
    ].join(":");
    let rows = rowsBySource.get(sourceKey);

    if (!rows) {
      rows = await loadEnrichedRows({
        cik: input.cik,
        source,
        asOfDate: input.asOfDate,
      });
      rowsBySource.set(sourceKey, rows);
    }

    const denominatorSource = resolveDenominatorSeriesSource({
      config: input.config,
      definition,
    });
    const counterpartSource = resolveCounterpartSeriesSource({
      config: input.config,
      definition,
    });
    let denominatorRows: EnrichedMetricSeriesSignalRow[] | undefined;
    let counterpartRows: EnrichedMetricSeriesSignalRow[] | undefined;

    if (denominatorSource) {
      const denominatorSourceKey = [
        denominatorSource.table,
        denominatorSource.version,
        denominatorSource.processKey ?? "",
        denominatorSource.metricKey,
        denominatorSource.periodType,
      ].join(":");
      denominatorRows = rowsBySource.get(denominatorSourceKey);

      if (!denominatorRows) {
        denominatorRows = await loadEnrichedRows({
          cik: input.cik,
          source: denominatorSource,
          asOfDate: input.asOfDate,
        });
        rowsBySource.set(denominatorSourceKey, denominatorRows);
      }
    }

    if (counterpartSource) {
      const counterpartSourceKey = [
        counterpartSource.table,
        counterpartSource.version,
        counterpartSource.processKey ?? "",
        counterpartSource.metricKey,
        counterpartSource.periodType,
      ].join(":");
      counterpartRows = rowsBySource.get(counterpartSourceKey);

      if (!counterpartRows) {
        counterpartRows = await loadEnrichedRows({
          cik: input.cik,
          source: counterpartSource,
          asOfDate: input.asOfDate,
        });
        rowsBySource.set(counterpartSourceKey, counterpartRows);
      }
    }

    const macroRows = definition.macroSource
      ? await loadMacroObservationRows(definition)
      : undefined;

    seriesBySignalKey.set(featureKey, {
      source,
      rows,
      macroRows,
      denominatorSource: denominatorSource ?? undefined,
      denominatorRows,
      counterpartSource: counterpartSource ?? undefined,
      counterpartRows,
    });
  }

  return seriesBySignalKey;
}

async function loadMacroObservationRows(
  definition: MetricFeatureDefinition,
): Promise<MacroObservationRow[]> {
  const macroSource = definition.macroSource;
  if (!macroSource) return [];

  const result = await db.query<MacroObservationRow>(
    `
    SELECT observation_date, value
    FROM public.fred_macro_series_observations
    WHERE series_id = $1
      AND units = $2
      AND value IS NOT NULL
    ORDER BY observation_date ASC
    `,
    [macroSource.seriesId, macroSource.units],
  );

  return result.rows;
}

async function loadEnrichedRows(input: {
  cik: string;
  source: ResolvedSignalSeriesSource;
  asOfDate?: string;
}): Promise<EnrichedMetricSeriesSignalRow[]> {
  if (input.source.table === "ticker_derived_metric_series") {
    return loadDerivedMetricRows(input);
  }

  return loadSecCompanyfactEnrichedRows(input);
}

async function loadSecCompanyfactEnrichedRows(input: {
  cik: string;
  source: ResolvedSignalSeriesSource;
  asOfDate?: string;
}): Promise<EnrichedMetricSeriesSignalRow[]> {
  const result = await db.query<EnrichedMetricSeriesSignalRow>(
    `
    SELECT
      ticker,
      cik,
      metric_key,
      source_tag,
      unit,
      val,
      "end",
      effective_date,
      period_type,
      yoy,
      qoq,
      yoy_delta,
      ttm_val,
      ttm_yoy,
      ttm_delta,
      rolling4_avg,
      duration_adjusted_val,
      duration_adjusted_yoy,
      duration_adjusted_qoq,
      duration_adjusted_yoy_delta,
      duration_adjusted_ttm_val,
      duration_adjusted_ttm_yoy,
      duration_adjusted_ttm_delta,
      duration_adjusted_rolling4_avg,
      is_turnaround,
      is_deterioration,
      is_loss_narrowing
    FROM public.sec_companyfact_metric_series_enriched
    WHERE cik = $1
      AND metric_key = $2
      AND period_type = $3
      AND ($4::date IS NULL OR effective_date <= $4::date)
    ORDER BY "end" ASC
    `,
    [
      input.cik,
      input.source.metricKey,
      input.source.periodType,
      input.asOfDate ?? null,
    ],
  );

  return result.rows;
}

async function loadDerivedMetricRows(input: {
  cik: string;
  source: ResolvedSignalSeriesSource;
  asOfDate?: string;
}): Promise<EnrichedMetricSeriesSignalRow[]> {
  if (!input.source.processKey) {
    throw new Error(
      `Missing processKey for derived metric source ${input.source.metricKey}`,
    );
  }

  const result = await db.query<{
    ticker: string;
    cik: string;
    derived_metric_key: string;
    value: number | string | null;
    value_type: string;
    period_end: Date | string;
    effective_date: Date | string;
  }>(
    `
    SELECT
      ticker,
      cik,
      derived_metric_key,
      value,
      value_type,
      period_end,
      effective_date
    FROM public.ticker_derived_metric_series
    WHERE cik = $1
      AND axis = $2
      AND process_key = $3
      AND derived_metric_key = $4
      AND source_version = $5
      AND ($6::date IS NULL OR effective_date <= $6::date)
    ORDER BY effective_date ASC, period_end ASC
    `,
    [
      input.cik,
      "valuation",
      input.source.processKey,
      input.source.metricKey,
      input.source.version,
      input.asOfDate ?? null,
    ],
  );

  return result.rows.flatMap((row) => {
    const metricValue = Number(row.value);
    if (!Number.isFinite(metricValue)) return [];

    return [
      {
        ticker: row.ticker,
        cik: row.cik,
        metric_key: row.derived_metric_key,
        source_tag: null,
        unit: row.value_type,
        metric_value: metricValue,
        val: metricValue,
        end: row.period_end,
        effective_date: row.effective_date,
        period_type: input.source.periodType,
        yoy: null,
        qoq: null,
        yoy_delta: null,
        ttm_val: null,
        ttm_yoy: null,
        ttm_delta: null,
        rolling4_avg: null,
        duration_adjusted_val: null,
        duration_adjusted_yoy: null,
        duration_adjusted_qoq: null,
        duration_adjusted_yoy_delta: null,
        duration_adjusted_ttm_val: null,
        duration_adjusted_ttm_yoy: null,
        duration_adjusted_ttm_delta: null,
        duration_adjusted_rolling4_avg: null,
        is_turnaround: null,
        is_deterioration: null,
        is_loss_narrowing: null,
      },
    ];
  });
}

async function upsertSignalRows(
  rows: TickerFactorMetricFeatureRow[],
  client: Pick<PoolClient, "query"> = db,
): Promise<void> {
  if (rows.length === 0) return;

  const values: unknown[] = [];
  const placeholders = rows.map((row, index) => {
    const offset = index * 11;

    values.push(
      row.ticker,
      row.cik,
      row.factor,
      row.axis,
      row.metric_key,
      row.feature_key,
      row.feature_value,
      row.period_end,
      row.effective_date,
      row.source_table,
      row.source_version,
    );

    return `(
      $${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4},
      $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8},
      $${offset + 9}, $${offset + 10}, $${offset + 11}
    )`;
  });

  await client.query(
    `
    INSERT INTO public.ticker_factor_metric_features (
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
    )
    VALUES ${placeholders.join(",")}
    ON CONFLICT (
      ticker,
      factor,
      axis,
      metric_key,
      feature_key,
      period_end,
      effective_date
    )
    DO UPDATE SET
      cik = EXCLUDED.cik,
      feature_value = EXCLUDED.feature_value,
      source_table = EXCLUDED.source_table,
      source_version = EXCLUDED.source_version,
      updated_at = now()
    `,
    values,
  );
}

async function refreshFeatureRowsForCikEffectiveDates(input: {
  ticker: string;
  cik: string;
  factor: FactorKey;
  axis: FactorAxisKey;
  metricKey: MetricFeatureMetricKey;
  rows: TickerFactorMetricFeatureRow[];
}): Promise<void> {
  if (input.rows.length === 0) return;

  const effectiveDates = getDistinctEffectiveDates(input.rows);
  const client = await db.connect();

  try {
    await client.query("BEGIN");
    await client.query(
      `
      DELETE FROM public.ticker_factor_metric_features
      WHERE ticker = $1
        AND cik = $2
        AND factor = $3
        AND axis = $4
        AND metric_key = $5
        AND effective_date = ANY($6::date[])
      `,
      [
        input.ticker,
        input.cik,
        input.factor,
        input.axis,
        input.metricKey,
        effectiveDates,
      ],
    );

    await upsertSignalRows(input.rows, client);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

function getDistinctEffectiveDates(
  rows: TickerFactorMetricFeatureRow[],
): string[] {
  return Array.from(new Set(rows.map((row) => row.effective_date))).sort();
}

export async function buildTickerFactorMetricFeaturesForCik(
  input: BuildInput,
): Promise<{ featureCount: number; periodCount: number }> {
  const config = await resolveMetricFeatureInterpretation({
    factor: input.factor ?? "growth",
    axis: input.axis ?? "fundamentals_based",
    metricKey: input.metricKey,
  });

  const seriesBySignalKey = await loadSignalSeriesBySignalKey({
    cik: input.cik,
    config,
    asOfDate: input.asOfDate,
  });
  const signProfileIndex = buildSignProfileIndex(
    await loadCompanyMetricSignProfiles(input.cik),
  );

  const signalRows = buildSignalRows({
    ticker: input.ticker,
    cik: input.cik,
    config,
    seriesBySignalKey,
    signProfileIndex,
  });

  await refreshFeatureRowsForCikEffectiveDates({
    ticker: input.ticker,
    cik: input.cik,
    factor: config.factor,
    axis: config.axis,
    metricKey: config.metricKey,
    rows: signalRows,
  });

  return {
    featureCount: signalRows.length,
    periodCount: Array.from(seriesBySignalKey.values()).reduce(
      (max, series) => Math.max(max, series.rows.length),
      0,
    ),
  };
}
