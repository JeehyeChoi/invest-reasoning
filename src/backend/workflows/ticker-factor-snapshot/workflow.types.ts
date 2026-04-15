import type { RevenueGrowthMetrics } from "@/shared/schemas/factors/growth";

export type TickerFactorSnapshotWorkflowState = {
  tickers: string[];
  factorInputs: Record<
    string,
    {
      growth?: {
        fundamentalsBased?: {
          revenue?: RevenueGrowthMetrics | null;
        };
      };
    }
  >;
  factorScores: Record<string, unknown>;
  snapshots: unknown[];
};

export type TickerFactorSnapshotStepResult = {
  state: TickerFactorSnapshotWorkflowState;
  notes?: string[];
};
