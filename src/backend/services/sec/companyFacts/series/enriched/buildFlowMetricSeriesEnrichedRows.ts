import { SEC_METRIC_DEFINITIONS } from "@/backend/config/sec/metrics";
import type {
  ComparablePeriodSourceKind,
  EnrichedMetricSeriesRow,
  MetricSeriesEnrichmentRow,
  TtmWindowSourceKind,
} from "@/backend/services/sec/companyFacts/series/enriched/types";

type ComparablePeriodMatch = {
  row: MetricSeriesEnrichmentRow;
  sourceKind: ComparablePeriodSourceKind;
};

type TtmWindowMatch = {
  rows: MetricSeriesEnrichmentRow[];
  sourceKind: TtmWindowSourceKind;
};

const QUARTER_GAP_MIN_DAYS = 60;
const QUARTER_GAP_MAX_DAYS = 130;
const YEAR_GAP_MIN_DAYS = 320;
const YEAR_GAP_MAX_DAYS = 410;
const TTM_SPAN_MIN_DAYS = 240;
const TTM_SPAN_MAX_DAYS = 430;
const NOMINAL_YEAR_DAYS = 365;
const NORMALIZED_QUARTER_DAYS = 91;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function calcGrowth(current: number | null, base: number | null): number | null {
  if (
    current === null ||
    base === null ||
    !Number.isFinite(current) ||
    !Number.isFinite(base) ||
    base === 0
  ) {
    return null;
  }

  return (current - base) / Math.abs(base);
}

function periodKey(
  row: Pick<MetricSeriesEnrichmentRow, "fiscal_year" | "fiscal_quarter">,
): string | null {
  if (row.fiscal_year == null || row.fiscal_quarter == null) return null;
  return `${row.fiscal_year}:${row.fiscal_quarter}`;
}

function previousQuarterKey(row: MetricSeriesEnrichmentRow): string | null {
  if (row.fiscal_year == null || row.fiscal_quarter == null) return null;

  if (row.fiscal_quarter === 1) {
    return `${row.fiscal_year - 1}:4`;
  }

  return `${row.fiscal_year}:${row.fiscal_quarter - 1}`;
}

function previousYearQuarterKey(row: MetricSeriesEnrichmentRow): string | null {
  if (row.fiscal_year == null || row.fiscal_quarter == null) return null;
  return `${row.fiscal_year - 1}:${row.fiscal_quarter}`;
}

function daysBetween(later: Date, earlier: Date): number {
  return Math.round((later.getTime() - earlier.getTime()) / MS_PER_DAY);
}

function rollingQuarterKeys(
  row: MetricSeriesEnrichmentRow,
  size: number,
): string[] | null {
  if (row.fiscal_year == null || row.fiscal_quarter == null) return null;

  const keys: string[] = [];
  let fiscalYear = row.fiscal_year;
  let fiscalQuarter = row.fiscal_quarter;

  for (let i = 0; i < size; i += 1) {
    keys.push(`${fiscalYear}:${fiscalQuarter}`);

    if (fiscalQuarter === 1) {
      fiscalYear -= 1;
      fiscalQuarter = 4;
    } else {
      fiscalQuarter -= 1;
    }
  }

  return keys;
}

function rowsByKeys(
  index: Map<string, MetricSeriesEnrichmentRow>,
  keys: string[] | null,
): MetricSeriesEnrichmentRow[] | null {
  if (!keys) return null;

  const rows: MetricSeriesEnrichmentRow[] = [];

  for (const key of keys) {
    const row = index.get(key);
    if (!row || !Number.isFinite(row.val)) return null;
    rows.push(row);
  }

  return rows;
}

function sumRows(rows: MetricSeriesEnrichmentRow[] | null): number | null {
  if (!rows || rows.length === 0) return null;

  let sum = 0;

  for (const row of rows) {
    if (!Number.isFinite(row.val)) return null;
    sum += row.val;
  }

  return sum;
}

function durationAdjustedVal(row: MetricSeriesEnrichmentRow | null): number | null {
  if (!row) return null;

  if (
    SEC_METRIC_DEFINITIONS[row.metric_key].durationPolicy !==
    "duration_adjust_growth"
  ) {
    return null;
  }

  if (
    row.duration_days == null ||
    row.duration_days <= 0 ||
    !Number.isFinite(row.duration_days) ||
    !Number.isFinite(row.val)
  ) {
    return null;
  }

  return (row.val / row.duration_days) * NORMALIZED_QUARTER_DAYS;
}

function sumDurationAdjustedRows(
  rows: MetricSeriesEnrichmentRow[] | null,
): number | null {
  if (!rows || rows.length === 0) return null;

  let sum = 0;

  for (const row of rows) {
    const adjusted = durationAdjustedVal(row);
    if (adjusted === null) return null;
    sum += adjusted;
  }

  return sum;
}

function isComparableQuarterGap(
  later: MetricSeriesEnrichmentRow,
  earlier: MetricSeriesEnrichmentRow,
): boolean {
  const gapDays = daysBetween(new Date(later.end), new Date(earlier.end));
  return gapDays >= QUARTER_GAP_MIN_DAYS && gapDays <= QUARTER_GAP_MAX_DAYS;
}

function isComparableYearGap(
  later: MetricSeriesEnrichmentRow,
  earlier: MetricSeriesEnrichmentRow,
): boolean {
  const gapDays = daysBetween(new Date(later.end), new Date(earlier.end));
  return gapDays >= YEAR_GAP_MIN_DAYS && gapDays <= YEAR_GAP_MAX_DAYS;
}

function isComparableTtmWindow(rows: MetricSeriesEnrichmentRow[]): boolean {
  if (rows.length !== 4) return false;

  const ordered = [...rows].sort(
    (a, b) => new Date(a.end).getTime() - new Date(b.end).getTime(),
  );

  for (let i = 1; i < ordered.length; i += 1) {
    if (!isComparableQuarterGap(ordered[i], ordered[i - 1])) return false;
  }

  const spanDays = daysBetween(
    new Date(ordered[ordered.length - 1].end),
    new Date(ordered[0].end),
  );

  return spanDays >= TTM_SPAN_MIN_DAYS && spanDays <= TTM_SPAN_MAX_DAYS;
}

function findComparablePreviousQuarter(
  sorted: MetricSeriesEnrichmentRow[],
  currentIndex: number,
  fiscalIndex: Map<string, MetricSeriesEnrichmentRow>,
): ComparablePeriodMatch | null {
  const current = sorted[currentIndex];
  const strict = fiscalIndex.get(previousQuarterKey(current) ?? "") ?? null;
  if (strict) {
    return {
      row: strict,
      sourceKind: "strict_fiscal_quarter",
    };
  }

  const previous = sorted[currentIndex - 1] ?? null;
  if (!previous || !isComparableQuarterGap(current, previous)) return null;

  return {
    row: previous,
    sourceKind: "comparable_date_gap",
  };
}

function findComparablePreviousYearQuarter(
  sorted: MetricSeriesEnrichmentRow[],
  currentIndex: number,
  fiscalIndex: Map<string, MetricSeriesEnrichmentRow>,
): ComparablePeriodMatch | null {
  const current = sorted[currentIndex];
  const strict = fiscalIndex.get(previousYearQuarterKey(current) ?? "") ?? null;
  if (strict) {
    return {
      row: strict,
      sourceKind: "strict_fiscal_quarter",
    };
  }

  let best: MetricSeriesEnrichmentRow | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (let i = currentIndex - 1; i >= 0; i -= 1) {
    const candidate = sorted[i];
    const gapDays = daysBetween(new Date(current.end), new Date(candidate.end));

    if (gapDays > YEAR_GAP_MAX_DAYS) break;
    if (!isComparableYearGap(current, candidate)) continue;
    if (!Number.isFinite(candidate.val)) continue;

    const distance = Math.abs(gapDays - NOMINAL_YEAR_DAYS);
    if (distance < bestDistance) {
      best = candidate;
      bestDistance = distance;
    }
  }

  return best
    ? {
      row: best,
      sourceKind: "comparable_date_gap",
    }
    : null;
}

function rollingComparableQuarterRows(input: {
  sorted: MetricSeriesEnrichmentRow[];
  currentIndex: number;
  fiscalIndex: Map<string, MetricSeriesEnrichmentRow>;
  size: number;
}): TtmWindowMatch | null {
  const current = input.sorted[input.currentIndex];
  const strictRows = rowsByKeys(
    input.fiscalIndex,
    rollingQuarterKeys(current, input.size),
  );

  if (strictRows) {
    return {
      rows: strictRows,
      sourceKind: "strict_fiscal_quarters",
    };
  }

  const startIndex = input.currentIndex - input.size + 1;
  if (startIndex < 0) return null;

  const chronologicalRows = input.sorted.slice(startIndex, input.currentIndex + 1);
  if (!isComparableTtmWindow(chronologicalRows)) return null;

  return {
    rows: chronologicalRows,
    sourceKind: "comparable_date_gap",
  };
}

function windowStart(rows: MetricSeriesEnrichmentRow[] | null): Date | null {
  if (!rows || rows.length === 0) return null;
  const sorted = [...rows].sort(
    (a, b) => new Date(a.end).getTime() - new Date(b.end).getTime(),
  );
  return new Date(sorted[0].end);
}

function windowEnd(rows: MetricSeriesEnrichmentRow[] | null): Date | null {
  if (!rows || rows.length === 0) return null;
  const sorted = [...rows].sort(
    (a, b) => new Date(a.end).getTime() - new Date(b.end).getTime(),
  );
  return new Date(sorted[sorted.length - 1].end);
}

function resolveTtmYoySourceKind(input: {
  currentWindow: TtmWindowMatch | null;
  previousWindow: TtmWindowMatch | null;
}): TtmWindowSourceKind | null {
  if (!input.currentWindow || !input.previousWindow) return null;

  if (
    input.currentWindow.sourceKind === "strict_fiscal_quarters" &&
    input.previousWindow.sourceKind === "strict_fiscal_quarters"
  ) {
    return "strict_fiscal_quarters";
  }

  return "comparable_date_gap";
}

export function buildFlowMetricSeriesEnrichedRows(
  rows: MetricSeriesEnrichmentRow[],
): EnrichedMetricSeriesRow[] {
  const sorted = [...rows].sort(
    (a, b) => new Date(a.end).getTime() - new Date(b.end).getTime(),
  );

  const fiscalIndex = new Map<string, MetricSeriesEnrichmentRow>();

  for (const row of sorted) {
    const key = periodKey(row);
    if (!key) continue;
    fiscalIndex.set(key, row);
  }

  const results: EnrichedMetricSeriesRow[] = [];
  const yoyByKey = new Map<string, number | null>();
  const durationAdjustedYoyByKey = new Map<string, number | null>();

  for (let i = 0; i < sorted.length; i += 1) {
    const current = sorted[i];
    const currentKey = periodKey(current);
    const prevMatch = findComparablePreviousQuarter(sorted, i, fiscalIndex);
    const prevYearMatch = findComparablePreviousYearQuarter(sorted, i, fiscalIndex);
    const prev = prevMatch?.row ?? null;
    const prevYear = prevYearMatch?.row ?? null;

    const yoy = prevYear ? calcGrowth(current.val, prevYear.val) : null;
    const qoq = prev ? calcGrowth(current.val, prev.val) : null;

    const previousYoy = prev ? yoyByKey.get(periodKey(prev) ?? "") ?? null : null;
    const yoy_delta =
      yoy !== null && previousYoy !== null ? yoy - previousYoy : null;

    const duration_adjusted_val = durationAdjustedVal(current);
    const prevDurationAdjustedVal = durationAdjustedVal(prev);
    const prevYearDurationAdjustedVal = durationAdjustedVal(prevYear);
    const duration_adjusted_yoy = calcGrowth(
      duration_adjusted_val,
      prevYearDurationAdjustedVal,
    );
    const duration_adjusted_qoq = calcGrowth(
      duration_adjusted_val,
      prevDurationAdjustedVal,
    );
    const previousDurationAdjustedYoy = prev
      ? durationAdjustedYoyByKey.get(periodKey(prev) ?? "") ?? null
      : null;
    const duration_adjusted_yoy_delta =
      duration_adjusted_yoy !== null && previousDurationAdjustedYoy !== null
        ? duration_adjusted_yoy - previousDurationAdjustedYoy
        : null;

    const ttmWindow = rollingComparableQuarterRows({
      sorted,
      currentIndex: i,
      fiscalIndex,
      size: 4,
    });
    const ttm_val = sumRows(ttmWindow?.rows ?? null);
    const duration_adjusted_ttm_val = sumDurationAdjustedRows(
      ttmWindow?.rows ?? null,
    );
    const prevYearIndex = prevYear ? sorted.indexOf(prevYear) : -1;
    const prevTtmWindow = prevYearIndex >= 0
      ? rollingComparableQuarterRows({
        sorted,
        currentIndex: prevYearIndex,
        fiscalIndex,
        size: 4,
      })
      : null;
    const prev_ttm_val = sumRows(prevTtmWindow?.rows ?? null);
    const prev_duration_adjusted_ttm_val = sumDurationAdjustedRows(
      prevTtmWindow?.rows ?? null,
    );

    const ttm_yoy = calcGrowth(ttm_val, prev_ttm_val);
    const ttm_delta =
      ttm_val !== null && prev_ttm_val !== null ? ttm_val - prev_ttm_val : null;
    const duration_adjusted_ttm_yoy = calcGrowth(
      duration_adjusted_ttm_val,
      prev_duration_adjusted_ttm_val,
    );
    const duration_adjusted_ttm_delta =
      duration_adjusted_ttm_val !== null &&
      prev_duration_adjusted_ttm_val !== null
        ? duration_adjusted_ttm_val - prev_duration_adjusted_ttm_val
        : null;

    const rolling4_avg = ttm_val !== null ? ttm_val / 4 : null;
    const duration_adjusted_rolling4_avg =
      duration_adjusted_ttm_val !== null ? duration_adjusted_ttm_val / 4 : null;

    const is_turnaround = prevYear
      ? prevYear.val < 0 && current.val > 0
      : null;

    const is_deterioration = prevYear
      ? prevYear.val > 0 && current.val < 0
      : null;

    const is_loss_narrowing = prevYear
      ? prevYear.val < 0 && current.val < 0 && current.val > prevYear.val
      : null;

    if (currentKey) {
      yoyByKey.set(currentKey, yoy);
      durationAdjustedYoyByKey.set(currentKey, duration_adjusted_yoy);
    }

    results.push({
      ...current,
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
      yoy_source_kind: yoy !== null ? prevYearMatch?.sourceKind ?? null : null,
      yoy_base_period_end: yoy !== null && prevYear ? new Date(prevYear.end) : null,
      qoq_source_kind: qoq !== null ? prevMatch?.sourceKind ?? null : null,
      qoq_base_period_end: qoq !== null && prev ? new Date(prev.end) : null,
      ttm_source_kind: ttm_val !== null ? ttmWindow?.sourceKind ?? null : null,
      ttm_window_start: ttm_val !== null ? windowStart(ttmWindow?.rows ?? null) : null,
      ttm_window_end: ttm_val !== null ? windowEnd(ttmWindow?.rows ?? null) : null,
      ttm_yoy_source_kind: ttm_yoy !== null
        ? resolveTtmYoySourceKind({
          currentWindow: ttmWindow,
          previousWindow: prevTtmWindow,
        })
        : null,
      ttm_yoy_base_window_start: ttm_yoy !== null
        ? windowStart(prevTtmWindow?.rows ?? null)
        : null,
      ttm_yoy_base_window_end: ttm_yoy !== null
        ? windowEnd(prevTtmWindow?.rows ?? null)
        : null,
      is_turnaround,
      is_deterioration,
      is_loss_narrowing,
    });
  }

  return results;
}
