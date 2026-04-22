import type { SecMetricKey } from "@/backend/schemas/sec/metrics";

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
  displayFrame: string | null;
};
