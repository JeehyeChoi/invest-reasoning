import type { RevenueGrowthMetrics } from "@/backend/schemas/factors/growth";

export type TickerFactorInputs = {
  growth?: {
    fundamentalsBased?: {
      revenue?: RevenueGrowthMetrics | null;
    };
  };
};

export type TickerFactorSnapshotWorkflowState = {
  tickers: string[];
  meta?: {
    tickerCikMap?: Record<string, string | null>;
  };
  factorInputs: Record<string, TickerFactorInputs>;
  factorScores: Record<string, unknown>; // TODO: replace with typed factor score shape
  snapshots: unknown[]; // TODO: replace with typed snapshot shape
};

export type TickerFactorSnapshotStepResult = {
  state: TickerFactorSnapshotWorkflowState;
  warnings?: string[];
};
