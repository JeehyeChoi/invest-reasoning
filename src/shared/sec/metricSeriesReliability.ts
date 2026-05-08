export const METRIC_SERIES_RELIABILITY_KEYS = [
  "seriesObservationDepth",
  "seriesFiscalContinuity",
  "seriesInputCoverage",
] as const;

export type MetricSeriesReliabilityKey =
  (typeof METRIC_SERIES_RELIABILITY_KEYS)[number];

export type MetricSeriesReliabilityDefinition = {
  key: MetricSeriesReliabilityKey;
  label: string;
  description: string;
  calculation: string;
  valueKind: "ratio";
  higherIsBetter: boolean;
};

export const METRIC_SERIES_RELIABILITY_DEFINITIONS = [
  {
    key: "seriesObservationDepth",
    label: "Observation Depth",
    description: "How much quarterly history is available for the metric.",
    calculation: "min(1, observed_quarter_index / 8)",
    valueKind: "ratio",
    higherIsBetter: true,
  },
  {
    key: "seriesFiscalContinuity",
    label: "Fiscal Continuity",
    description:
      "How consistently recent metric observations follow consecutive fiscal quarters.",
    calculation: "continuous_quarter_transitions / observed_quarter_transitions over the latest 8 observations",
    valueKind: "ratio",
    higherIsBetter: true,
  },
  {
    key: "seriesInputCoverage",
    label: "Input Coverage",
    description:
      "How completely the enriched metric row provides inputs used by signal calculations.",
    calculation: "finite_enriched_signal_inputs / tracked_enriched_signal_inputs",
    valueKind: "ratio",
    higherIsBetter: true,
  },
] as const satisfies readonly MetricSeriesReliabilityDefinition[];

export const METRIC_SERIES_RELIABILITY_DEFINITION_BY_KEY =
  Object.fromEntries(
    METRIC_SERIES_RELIABILITY_DEFINITIONS.map((definition) => [
      definition.key,
      definition,
    ]),
  ) as Record<MetricSeriesReliabilityKey, MetricSeriesReliabilityDefinition>;
