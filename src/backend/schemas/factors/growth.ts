import type { SecMetricKey } from "@/backend/schemas/sec/metrics";

export type GrowthMetricSignals = {
  yoy: number | null;
  qoq: number | null;
  consistency: number | null;
  acceleration: number | null;
  score: number | null;
};

export type GrowthMetricBreakdown = {
  metricKey: SecMetricKey;
  signals: GrowthMetricSignals;
};

export type GrowthMetricSignalsExtended = GrowthMetricSignals & {
  turnaround?: boolean | null;
  deterioration?: boolean | null;
  profitabilityState?: "profit" | "loss" | null;
  lossNarrowing?: boolean | null;
};
