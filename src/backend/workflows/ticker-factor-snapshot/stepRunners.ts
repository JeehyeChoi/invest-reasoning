import { run as runGrowthFundamentalsRevenue } from "@/backend/workflows/ticker-factor-snapshot/steps/growth/fundamentals_based/revenue/run";
import { run as runGrowthFundamentalsNetIncome } from "@/backend/workflows/ticker-factor-snapshot/steps/growth/fundamentals_based/net_income/run";

import type { StepRunnerMap } from "./workflow.step.types";

export const STEP_RUNNERS: StepRunnerMap = {
  growth: {
    fundamentals_based: {
      revenue: runGrowthFundamentalsRevenue,
      net_income: runGrowthFundamentalsNetIncome,
    },
  },
};
