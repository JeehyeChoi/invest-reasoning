export type TickerMetricSeries = {
  ticker: string;
  metricKey: string;
  points: TickerMetricSeriesPoint[];
};

export type TickerMetricSeriesPoint = {
	start: string | null;
  end: string;
  filed: string | null;
  val: number;
	periodType?: string | null;
	durationDays?: number | null;
	fiscalYear?: number | null;
	fiscalQuarter?: number | null;
	buildSourceKind?: string | null;
	rolling4Avg?: number | null;
};
