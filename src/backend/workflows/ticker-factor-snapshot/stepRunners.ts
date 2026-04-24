import { run as runGrowthFundamentalsBasedCapex } from "@/backend/workflows/ticker-factor-snapshot/steps/growth/fundamentals_based/capex/run";
import { run as runGrowthFundamentalsBasedGrossProfit } from "@/backend/workflows/ticker-factor-snapshot/steps/growth/fundamentals_based/gross_profit/run";
import { run as runGrowthFundamentalsBasedNetIncome } from "@/backend/workflows/ticker-factor-snapshot/steps/growth/fundamentals_based/net_income/run";
import { run as runGrowthFundamentalsBasedOperatingCashFlow } from "@/backend/workflows/ticker-factor-snapshot/steps/growth/fundamentals_based/operating_cash_flow/run";
import { run as runGrowthFundamentalsBasedOperatingIncome } from "@/backend/workflows/ticker-factor-snapshot/steps/growth/fundamentals_based/operating_income/run";
import { run as runGrowthFundamentalsBasedRevenue } from "@/backend/workflows/ticker-factor-snapshot/steps/growth/fundamentals_based/revenue/run";

import type { StepRunnerMap } from "./workflow.step.types";

export const STEP_RUNNERS: StepRunnerMap = {
  growth: {
    fundamentals_based: {
      capex: runGrowthFundamentalsBasedCapex,
      gross_profit: runGrowthFundamentalsBasedGrossProfit,
      net_income: runGrowthFundamentalsBasedNetIncome,
      operating_cash_flow: runGrowthFundamentalsBasedOperatingCashFlow,
      operating_income: runGrowthFundamentalsBasedOperatingIncome,
      revenue: runGrowthFundamentalsBasedRevenue,
    },
  },
};
