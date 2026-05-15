import type {
  ComparablePeriodSourceKind,
  EnrichedMetricSeriesRow,
  MetricSeriesEnrichmentRow,
} from "@/backend/services/sec/companyFacts/series/enriched/types";

type ComparableInstantMatch = {
  row: MetricSeriesEnrichmentRow;
  sourceKind: ComparablePeriodSourceKind;
};

const QUARTER_GAP_MIN_DAYS = 60;
const QUARTER_GAP_MAX_DAYS = 130;
const YEAR_GAP_MIN_DAYS = 320;
const YEAR_GAP_MAX_DAYS = 410;
const NOMINAL_YEAR_DAYS = 365;
const ROLLING_SNAPSHOT_SIZE = 4;
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

function previousYearQuarterKey(row: MetricSeriesEnrichmentRow): string | null {
  if (row.fiscal_year == null || row.fiscal_quarter == null) return null;
  return `${row.fiscal_year - 1}:${row.fiscal_quarter}`;
}

function daysBetween(later: Date, earlier: Date): number {
  return Math.round((later.getTime() - earlier.getTime()) / MS_PER_DAY);
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

function findComparablePreviousSnapshot(
  sorted: MetricSeriesEnrichmentRow[],
  currentIndex: number,
): ComparableInstantMatch | null {
  const current = sorted[currentIndex];
  const previous = sorted[currentIndex - 1] ?? null;

  if (!previous || !isComparableQuarterGap(current, previous)) return null;

  return {
    row: previous,
    sourceKind: "comparable_date_gap",
  };
}

function findComparablePreviousYearSnapshot(
  sorted: MetricSeriesEnrichmentRow[],
  currentIndex: number,
  fiscalIndex: Map<string, MetricSeriesEnrichmentRow>,
): ComparableInstantMatch | null {
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

function rollingSnapshotAverage(
  sorted: MetricSeriesEnrichmentRow[],
  currentIndex: number,
): number | null {
  const startIndex = currentIndex - ROLLING_SNAPSHOT_SIZE + 1;
  if (startIndex < 0) return null;

  const window = sorted.slice(startIndex, currentIndex + 1);
  if (window.length !== ROLLING_SNAPSHOT_SIZE) return null;

  let total = 0;

  for (const row of window) {
    if (!Number.isFinite(row.val)) return null;
    total += row.val;
  }

  return total / ROLLING_SNAPSHOT_SIZE;
}

function rollingSnapshotRows(
  sorted: MetricSeriesEnrichmentRow[],
  currentIndex: number,
): MetricSeriesEnrichmentRow[] {
  const startIndex = currentIndex - ROLLING_SNAPSHOT_SIZE + 1;
  if (startIndex < 0) return [];

  const window = sorted.slice(startIndex, currentIndex + 1);
  return window.length === ROLLING_SNAPSHOT_SIZE ? window : [];
}

function effectiveDateFromRows(
  rows: Array<MetricSeriesEnrichmentRow | null | undefined>,
): Date {
  const timestamps = rows.flatMap((row) => {
    if (!row) return [];
    const value = row.effective_date;
    const time = new Date(value).getTime();
    return Number.isFinite(time) ? [time] : [];
  });
  const latest = timestamps.length > 0
    ? Math.max(...timestamps)
    : Date.now();

  return new Date(latest);
}

function groupRowsByComparableSeries(
  rows: MetricSeriesEnrichmentRow[],
): MetricSeriesEnrichmentRow[][] {
  const groups = new Map<string, MetricSeriesEnrichmentRow[]>();

  for (const row of rows) {
    const key = [row.fact_type, row.unit].join(":");
    const group = groups.get(key) ?? [];

    group.push(row);
    groups.set(key, group);
  }

  return [...groups.values()];
}

function buildInstantGroupEnrichedRows(
  rows: MetricSeriesEnrichmentRow[],
): EnrichedMetricSeriesRow[] {
  const sorted = [...rows].sort(
    (a, b) => new Date(a.end).getTime() - new Date(b.end).getTime(),
  );
  const fiscalIndex = new Map<string, MetricSeriesEnrichmentRow>();
  const yoyByEnd = new Map<string, number | null>();
  const results: EnrichedMetricSeriesRow[] = [];

  for (const row of sorted) {
    const key = periodKey(row);
    if (!key) continue;
    fiscalIndex.set(key, row);
  }

  for (let i = 0; i < sorted.length; i += 1) {
    const current = sorted[i];
    const prevMatch = findComparablePreviousSnapshot(sorted, i);
    const prevYearMatch = findComparablePreviousYearSnapshot(
      sorted,
      i,
      fiscalIndex,
    );
    const prev = prevMatch?.row ?? null;
    const prevYear = prevYearMatch?.row ?? null;
    const yoy = prevYear ? calcGrowth(current.val, prevYear.val) : null;
    const qoq = prev ? calcGrowth(current.val, prev.val) : null;
    const previousYoy = prev ? yoyByEnd.get(new Date(prev.end).toISOString()) ?? null : null;
    const yoy_delta =
      yoy !== null && previousYoy !== null ? yoy - previousYoy : null;
    const rolling4_avg = rollingSnapshotAverage(sorted, i);
    const rollingRows = rolling4_avg !== null ? rollingSnapshotRows(sorted, i) : [];

    yoyByEnd.set(new Date(current.end).toISOString(), yoy);

    results.push({
      ...current,
      effective_date: effectiveDateFromRows([
        current,
        prev,
        prevYear,
        ...rollingRows,
      ]),
      yoy,
      qoq,
      yoy_delta,
      ttm_val: null,
      ttm_yoy: null,
      ttm_delta: null,
      rolling4_avg,
      duration_adjusted_val: null,
      duration_adjusted_yoy: null,
      duration_adjusted_qoq: null,
      duration_adjusted_yoy_delta: null,
      duration_adjusted_ttm_val: null,
      duration_adjusted_ttm_yoy: null,
      duration_adjusted_ttm_delta: null,
      duration_adjusted_rolling4_avg: null,
      yoy_source_kind: yoy !== null ? prevYearMatch?.sourceKind ?? null : null,
      yoy_base_period_end: yoy !== null && prevYear ? new Date(prevYear.end) : null,
      qoq_source_kind: qoq !== null ? prevMatch?.sourceKind ?? null : null,
      qoq_base_period_end: qoq !== null && prev ? new Date(prev.end) : null,
      ttm_source_kind: null,
      ttm_window_start: null,
      ttm_window_end: null,
      ttm_yoy_source_kind: null,
      ttm_yoy_base_window_start: null,
      ttm_yoy_base_window_end: null,
      is_turnaround: null,
      is_deterioration: null,
      is_loss_narrowing: null,
    });
  }

  return results;
}

export function buildInstantMetricSeriesEnrichedRows(
  rows: MetricSeriesEnrichmentRow[],
): EnrichedMetricSeriesRow[] {
  return groupRowsByComparableSeries(rows)
    .flatMap((group) => buildInstantGroupEnrichedRows(group))
    .sort((a, b) => new Date(a.end).getTime() - new Date(b.end).getTime());
}
