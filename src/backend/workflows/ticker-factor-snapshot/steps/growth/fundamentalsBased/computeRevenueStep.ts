// src/backend/workflows/ticker-factor-snapshot/steps/growth/fundamentalsBased/computeRevenueStep.ts

import { computeRevenueGrowthMetrics } from "@/backend/services/factors/growth/fundamentalsBased/computeRevenueGrowthMetrics";
import { getTickerProfilesByTickers } from "@/backend/services/metadata/tickerReadRepository";
import type {
  TickerFactorSnapshotStepResult,
  TickerFactorSnapshotWorkflowState,
} from "@/backend/workflows/ticker-factor-snapshot/workflow.types";

export async function computeRevenueStep(
  state: TickerFactorSnapshotWorkflowState
): Promise<TickerFactorSnapshotStepResult> {
  const tickers = state.tickers ?? [];

  if (tickers.length === 0) {
    return {
      state,
      notes: ["No tickers provided for revenue computation."],
    };
  }

  const profiles = await getTickerProfilesByTickers(tickers);
  const profileMap = new Map(
    profiles.map((profile) => [profile.ticker.trim().toUpperCase(), profile])
  );

  const nextFactorInputs = { ...(state.factorInputs ?? {}) };

  for (const ticker of tickers) {
    const profile = profileMap.get(ticker);
    const cik = profile?.cik?.trim() ?? null;

    if (!nextFactorInputs[ticker]) {
      nextFactorInputs[ticker] = {};
    }

    if (!nextFactorInputs[ticker].growth) {
      nextFactorInputs[ticker].growth = {};
    }

    if (!nextFactorInputs[ticker].growth.fundamentalsBased) {
      nextFactorInputs[ticker].growth.fundamentalsBased = {};
    }

    if (!cik) {
      nextFactorInputs[ticker].growth.fundamentalsBased.revenue = null;
      continue;
    }

    const revenueMetrics = await computeRevenueGrowthMetrics(cik);
    nextFactorInputs[ticker].growth.fundamentalsBased.revenue = revenueMetrics;
  }

  return {
    state: {
      ...state,
      factorInputs: nextFactorInputs,
    },
    notes: [`Computed fundamentals-based revenue inputs for ${tickers.length} tickers.`],
  };
}
