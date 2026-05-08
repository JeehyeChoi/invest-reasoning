import { loadUniverseTickers } from "@/backend/services/universe/loadUniverseTickers";
import { syncEtfUniverseMemberships } from "@/backend/services/universe/syncEtfUniverseMemberships";
import { syncSp500UniverseMemberships } from "@/backend/services/universe/syncSp500UniverseMemberships";
import {
  normalizeUniverseKeys,
  type UniverseKey,
} from "@/shared/universe/universes";
import type { DataPipelineUniverseRefreshMode } from "@/shared/data-pipeline/jobs";

export type RunUniverseSelectionWorkflowInput = {
  universeKeys?: UniverseKey[];
  refreshMode?: DataPipelineUniverseRefreshMode;
};

export type RunUniverseSelectionWorkflowResult = {
  universeKeys: UniverseKey[];
  refreshMode: DataPipelineUniverseRefreshMode;
  refreshedUniverseKeys: UniverseKey[];
  unsupportedRefreshUniverseKeys: UniverseKey[];
  tickers: string[];
};

export async function runUniverseSelectionWorkflow(
  input: RunUniverseSelectionWorkflowInput = {},
): Promise<RunUniverseSelectionWorkflowResult> {
  const universeKeys = normalizeUniverseKeys(input.universeKeys);
  const refreshMode = input.refreshMode ?? "skip";
  const refreshedUniverseKeys: UniverseKey[] = [];
  const unsupportedRefreshUniverseKeys: UniverseKey[] = [];

  if (refreshMode === "selected") {
    for (const universeKey of universeKeys) {
      if (universeKey === "sp500") {
        await syncSp500UniverseMemberships();
        refreshedUniverseKeys.push(universeKey);
      } else if (
        universeKey === "sp400" ||
        universeKey === "sp600" ||
        universeKey === "djia"
      ) {
        await syncEtfUniverseMemberships(universeKey);
        refreshedUniverseKeys.push(universeKey);
      } else if (universeKey === "factor_proxy_etfs") {
        // Manual seed universe maintained by db/universes.sql.
      } else {
        unsupportedRefreshUniverseKeys.push(universeKey);
      }
    }
  }

  const tickers = await loadUniverseTickers({ universeKeys });

  if (tickers.length === 0) {
    throw new Error(
      `Selected universe memberships are empty: ${universeKeys.join(", ")}. Sync the selected universe memberships first or choose a universe with stored active members.`,
    );
  }

  return {
    universeKeys,
    refreshMode,
    refreshedUniverseKeys,
    unsupportedRefreshUniverseKeys,
    tickers,
  };
}
