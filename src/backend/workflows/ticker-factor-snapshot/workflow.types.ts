import type { FactorKey, FactorScoreAxisKey } from "@/backend/schemas/factor";
import type { GrowthMetricSignalsExtended } from "@/backend/schemas/factors/growth";
import type { SecMetricKey } from "@/backend/schemas/sec/metrics";

type FactorAxisMetricMap = Partial<
  Record<SecMetricKey, GrowthMetricSignalsExtended | null>
>;

export type TickerFactorInputs = Partial<
  Record<
    FactorKey,
    Partial<Record<FactorScoreAxisKey, FactorAxisMetricMap>>
  >
>;

export type TickerFactorSnapshotWorkflowState = {
  tickers: string[];
  meta?: {
    tickerCikMap?: Record<string, string | null>;
  };
  factorInputs: Record<string, TickerFactorInputs>;
  factorScores: Record<string, unknown>;
  snapshots: unknown[];
};

export type TickerFactorSnapshotStepResult = {
  state: TickerFactorSnapshotWorkflowState;
  warnings?: string[];
};
