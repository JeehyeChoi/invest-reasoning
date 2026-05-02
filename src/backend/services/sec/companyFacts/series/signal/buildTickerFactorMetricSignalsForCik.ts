import { db } from "@/backend/config/db";
import type { FactorKey, FactorScoreAxisKey } from "@/shared/factors/factors";
import type { SecMetricKey } from "@/shared/sec/metrics";
import { resolveMetricSignalInterpretation } from "@/backend/services/sec/companyFacts/series/signal/resolveMetricSignalInterpretation";
import { requireDateKey } from "@/backend/services/sec/companyFacts/series/utils/dateKey";
import type { PoolClient } from "pg";
import type {
  EnrichedMetricSeriesSignalRow,
  MetricSignalDefinition,
  MetricSignalInterpretationConfig,
  MetricSignalSourceKey,
  TickerFactorMetricSignalRow,
} from "@/backend/services/sec/companyFacts/series/signal/types";

type BuildInput = {
  ticker: string;
  cik: string;
  factor?: FactorKey;
  axis?: FactorScoreAxisKey;
  metricKey: SecMetricKey;
};

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function getSourceValue(
  row: EnrichedMetricSeriesSignalRow,
  source: MetricSignalSourceKey | undefined,
): number | boolean | null {
  if (!source) return null;
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
  source: MetricSignalSourceKey | undefined,
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

function calcValidRatio(
  rows: EnrichedMetricSeriesSignalRow[],
  source: MetricSignalSourceKey | undefined,
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
  definition: MetricSignalDefinition,
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

function calcSignalValue(input: {
  rows: EnrichedMetricSeriesSignalRow[];
  currentIndex: number;
  definition: MetricSignalDefinition;
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

  if (method === "valid_ratio") {
    const lookback = input.definition.lookback ?? 4;
    const window = input.rows.slice(
      Math.max(0, input.currentIndex - lookback + 1),
      input.currentIndex + 1,
    );

    if (window.length < lookback) return null;
    return calcValidRatio(window, input.definition.source);
  }

  if (method === "relative_deviation") {
    return calcRelativeDeviation(
      getSourceValue(current, input.definition.source),
      getSourceValue(current, input.definition.reference),
    );
  }

  if (method === "profitability_shift" || input.definition.sources) {
    return calcProfitabilityShift(current, input.definition);
  }

  return toSignalNumber(getSourceValue(current, input.definition.source));
}

function buildSignalRows(input: {
  ticker: string;
  cik: string;
  rows: EnrichedMetricSeriesSignalRow[];
  config: MetricSignalInterpretationConfig;
}): TickerFactorMetricSignalRow[] {
  const output: TickerFactorMetricSignalRow[] = [];

  input.rows.forEach((row, index) => {
    for (const [signalKey, definition] of Object.entries(input.config.signals)) {
      if (definition.enabled === false) continue;

      const signalValue = calcSignalValue({
        rows: input.rows,
        currentIndex: index,
        definition,
      });

      if (signalValue === null) continue;

      output.push({
        ticker: row.ticker ?? input.ticker,
        cik: input.cik,
        factor: input.config.factor,
        axis: input.config.axis,
        metric_key: input.config.metricKey,
        signal_key: signalKey,
        signal_value: signalValue,
        period_end: requireDateKey(row.end),
        effective_date: requireDateKey(row.end),
        source_table: input.config.source.table,
        source_version: input.config.source.version,
      });
    }
  });

  return output;
}

async function loadEnrichedRows(input: {
  cik: string;
  metricKey: SecMetricKey;
  periodType: string;
}): Promise<EnrichedMetricSeriesSignalRow[]> {
  const result = await db.query<EnrichedMetricSeriesSignalRow>(
    `
    SELECT
      ticker,
      cik,
      metric_key,
      val,
      "end",
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
    ORDER BY "end" ASC
    `,
    [input.cik, input.metricKey, input.periodType],
  );

  return result.rows;
}

async function upsertSignalRows(
  rows: TickerFactorMetricSignalRow[],
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
      row.signal_key,
      row.signal_value,
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
    INSERT INTO public.ticker_factor_metric_signals (
      ticker,
      cik,
      factor,
      axis,
      metric_key,
      signal_key,
      signal_value,
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
      signal_key,
      period_end,
      effective_date
    )
    DO UPDATE SET
      cik = EXCLUDED.cik,
      signal_value = EXCLUDED.signal_value,
      source_table = EXCLUDED.source_table,
      source_version = EXCLUDED.source_version,
      updated_at = now()
    `,
    values,
  );
}

async function replaceSignalRowsForCik(input: {
  ticker: string;
  cik: string;
  factor: FactorKey;
  axis: FactorScoreAxisKey;
  metricKey: SecMetricKey;
  rows: TickerFactorMetricSignalRow[];
}): Promise<void> {
  const client = await db.connect();

  try {
    await client.query("BEGIN");
    await client.query(
      `
      DELETE FROM public.ticker_factor_metric_signals
      WHERE ticker = $1
        AND cik = $2
        AND factor = $3
        AND axis = $4
        AND metric_key = $5
      `,
      [input.ticker, input.cik, input.factor, input.axis, input.metricKey],
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

export async function buildTickerFactorMetricSignalsForCik(
  input: BuildInput,
): Promise<{ signalCount: number; periodCount: number }> {
  const config = await resolveMetricSignalInterpretation({
    factor: input.factor ?? "growth",
    axis: input.axis ?? "fundamentals_based",
    metricKey: input.metricKey,
  });

  const rows = await loadEnrichedRows({
    cik: input.cik,
    metricKey: input.metricKey,
    periodType: config.source.periodType,
  });

  const signalRows = buildSignalRows({
    ticker: input.ticker,
    cik: input.cik,
    rows,
    config,
  });

  await replaceSignalRowsForCik({
    ticker: input.ticker,
    cik: input.cik,
    factor: config.factor,
    axis: config.axis,
    metricKey: config.metricKey,
    rows: signalRows,
  });

  return {
    signalCount: signalRows.length,
    periodCount: rows.length,
  };
}
