import type { SecMetricKey } from "@/shared/sec/metrics";

export type TickerMetricSeries = {
  ticker: string;
  metricKey: SecMetricKey;
  points: TickerMetricSeriesPoint[];
};

export type TickerMetricSeriesPoint = {
	start: string | null;
  end: string;
  filed: string | null;
  val: number;
	durationDays?: number | null;
	fiscalYear?: number | null;
	fiscalQuarter?: number | null;
	buildSourceKind?: string | null;
};
