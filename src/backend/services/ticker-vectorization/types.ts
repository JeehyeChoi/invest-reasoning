import type { FactorAxisKey } from "@/shared/factors/axes";
import type { FactorKey } from "@/shared/factors/factors";

export type TickerVectorNormalizationMethod =
  | "none"
  | "robust_z_score"
  | "sign";

export type TickerVectorMode = "metric_feature" | "factor_signal";

export type TickerVectorSourcePolicy =
  | "feature_value"
  | "signal_activation";

export type TickerVectorTarget = {
  factor: FactorKey;
  axis: FactorAxisKey;
};

export type TickerVectorizationInput = {
  targets: TickerVectorTarget[];
  comparisonSetType: string;
  comparisonSetKey: string;
  asOfDate?: string;
  normalizationMethod: TickerVectorNormalizationMethod;
  vectorMode: TickerVectorMode;
  vectorSourcePolicy: TickerVectorSourcePolicy;
  minTickerCoverageRatio: number;
  minFeatureCoverageRatio: number;
  minUniverseCount: number;
  zScoreClip: number;
};

export type TickerVectorSourceRow = {
  ticker: string;
  cik: string | null;
  factor: string;
  axis: string;
  metric_key: string;
  feature_key: string;
  feature_value: number | null;
  universe_count: number | null;
  period_end: string | null;
  effective_date: string;
};

export type TickerVector = {
  ticker: string;
  values: number[];
  observedFeatureCount: number;
  missingFeatureCount: number;
  coverageRatio: number;
};

export type TickerVectorMatrix = {
  featureKeys: string[];
  vectors: TickerVector[];
  vectorEffectiveDate: string;
};
