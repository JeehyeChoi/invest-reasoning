// src/backend/workflows/ticker-factor-snapshot/runTickerFactorSnapshotsWorkflow.ts

import { normalizeTickers } from "@/shared/utils/tickers";
import { computeRevenueStep } from "./steps/growth/fundamentalsBased/computeRevenueStep";
//import { computeFactorScoresStep } from "./steps/computeFactorScoresStep";
//import { buildSnapshotStep } from "./steps/buildSnapshotStep";
//import { persistSnapshotStep } from "./steps/persistSnapshotStep";
import type { TickerFactorSnapshotWorkflowState } from "./workflow.types";

export async function runTickerFactorSnapshotsWorkflow(input: {
  tickers: string[];
}): Promise<TickerFactorSnapshotWorkflowState> {
  let state: TickerFactorSnapshotWorkflowState = {
    tickers: normalizeTickers(input.tickers),
    factorInputs: {},
    factorScores: {},
    snapshots: [],
  };

  state = (await computeRevenueStep(state)).state;
  //state = (await computeFactorScoresStep(state)).state;
  //state = (await buildSnapshotStep(state)).state;
  //state = (await persistSnapshotStep(state)).state;

  return state;
}
