import type { FactorKey, FactorScoreAxisKey } from "@/backend/schemas/factor";
import type { SecMetricKey } from "@/backend/schemas/sec/metrics";
import type {
  TickerFactorSnapshotWorkflowState,
  TickerFactorSnapshotStepResult,
} from "./workflow.types";

export type StepContext = {
  factor: FactorKey;
  axis: FactorScoreAxisKey;
  metricKey: SecMetricKey;
};

export type StepRunner = (
  state: TickerFactorSnapshotWorkflowState,
  context: StepContext,
) => Promise<TickerFactorSnapshotStepResult>;

export type StepRunnerMap = Partial<
  Record<
    FactorKey,
    Partial<
      Record<
        FactorScoreAxisKey,
        Partial<Record<SecMetricKey, StepRunner>>
      >
    >
  >
>;
