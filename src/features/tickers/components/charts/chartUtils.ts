import type { TickerMetricSeries } from "@/backend/schemas/tickers/tickerMetricSeries";

export type ChartRange = "3Y" | "5Y" | "10Y" | "MAX";

export function filterPointsByRange(
  points: TickerMetricSeries["points"],
  range: ChartRange,
): TickerMetricSeries["points"] {
  if (range === "MAX") {
    return points;
  }

  const years = range === "3Y" ? 3 : range === "5Y" ? 5 : 10;
  const latestDate = new Date(points[points.length - 1].end);
  const cutoff = new Date(latestDate);
  cutoff.setFullYear(cutoff.getFullYear() - years);

  const filtered = points.filter((point) => new Date(point.end) >= cutoff);

  return filtered.length > 1 ? filtered : points;
}

export function buildYearlyXAxisTicksFromTime(input: {
  points: TickerMetricSeries["points"];
  minTime: number;
  maxTime: number;
  paddingLeft: number;
  innerWidth: number;
}) {
  const { points, minTime, maxTime, paddingLeft, innerWidth } = input;

  if (points.length === 0) {
    return [];
  }

  const startYear = new Date(minTime).getFullYear();
  const endYear = new Date(maxTime).getFullYear();
  const timeRange = Math.max(maxTime - minTime, 1);

  const ticks: Array<{ x: number; label: string }> = [];

  for (let year = startYear; year <= endYear; year += 1) {
    const tickTime = new Date(`${year}-01-01T00:00:00Z`).getTime();
    const ratio = (tickTime - minTime) / timeRange;
    const x = paddingLeft + ratio * innerWidth;

    if (Number.isFinite(x)) {
      ticks.push({
        x,
        label: String(year),
      });
    }
  }

  return ticks.filter((tick) => tick.x >= paddingLeft && tick.x <= paddingLeft + innerWidth);
}

export function formatQuarterLabel(dateString: string): string {
  const date = new Date(dateString);
  const year = String(date.getFullYear()).slice(2);
  const month = date.getMonth() + 1;

  const quarter =
    month <= 3 ? "Q1" : month <= 6 ? "Q2" : month <= 9 ? "Q3" : "Q4";

  return `${year}${quarter}`;
}

export function formatDateRange(point: { start?: string | null; end: string }): string {
  if (!point.start) {
    return point.end;
  }

  return `${point.start} → ${point.end}`;
}

export function formatAxisValue(value: number): string {
  if (!Number.isFinite(value)) {
    return "-";
  }

  if (Math.abs(value) >= 1_000_000_000_000) {
    return `${(value / 1_000_000_000_000).toFixed(1)}T`;
  }

  if (Math.abs(value) >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toFixed(1)}B`;
  }

  if (Math.abs(value) >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }

  if (Math.abs(value) >= 1_000) {
    return `${(value / 1_000).toFixed(1)}K`;
  }

  return value.toFixed(0);
}
