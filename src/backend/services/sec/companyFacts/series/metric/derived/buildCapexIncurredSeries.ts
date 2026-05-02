import type { FlowMetricSeriesPoint } from "@/backend/services/sec/companyFacts/series/metric/derived/types";
import type { TickerMetricSeriesPoint } from "@/shared/tickers/tickerMetricSeries";

function maxFiledDate(
  left: string | null | undefined,
  right: string | null | undefined,
): string | null {
  if (!left) return right ?? null;
  if (!right) return left;
  return left >= right ? left : right;
}

export function buildCapexIncurredFlowSeries(
  cashPoints: FlowMetricSeriesPoint[],
  unpaidPoints: FlowMetricSeriesPoint[],
): FlowMetricSeriesPoint[] {
  const unpaidByEnd = new Map(unpaidPoints.map((point) => [point.end, point]));
  const derivedPoints: FlowMetricSeriesPoint[] = [];

  for (const cashPoint of cashPoints) {
    const unpaidPoint = unpaidByEnd.get(cashPoint.end);
    if (!unpaidPoint) {
      continue;
    }

    derivedPoints.push({
      end: cashPoint.end,
      filed: maxFiledDate(cashPoint.filed, unpaidPoint.filed),
      val: cashPoint.val + unpaidPoint.val,
      periodType: cashPoint.periodType,
      buildSourceKind: "formula_derived",
    });
  }

  return derivedPoints;
}

export function buildCapexIncurredTickerPoints(
  cashPoints: TickerMetricSeriesPoint[],
  unpaidPoints: TickerMetricSeriesPoint[],
): TickerMetricSeriesPoint[] {
  const unpaidByEnd = new Map(unpaidPoints.map((point) => [point.end, point]));
  const derivedPoints: TickerMetricSeriesPoint[] = [];

  for (const cashPoint of cashPoints) {
    const unpaidPoint = unpaidByEnd.get(cashPoint.end);
    if (!unpaidPoint) {
      continue;
    }

    derivedPoints.push({
      start: cashPoint.start ?? unpaidPoint.start ?? null,
      end: cashPoint.end,
      filed: maxFiledDate(cashPoint.filed, unpaidPoint.filed),
      val: cashPoint.val + unpaidPoint.val,
      durationDays: cashPoint.durationDays ?? unpaidPoint.durationDays ?? null,
      fiscalYear: cashPoint.fiscalYear ?? unpaidPoint.fiscalYear,
      fiscalQuarter: cashPoint.fiscalQuarter ?? unpaidPoint.fiscalQuarter,
      buildSourceKind: "formula_derived",
    });
  }

  return derivedPoints;
}
