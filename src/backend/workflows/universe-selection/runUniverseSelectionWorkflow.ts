import { loadUniverseTickers } from "@/backend/services/universe/loadUniverseTickers";
import { syncSp500UniverseMemberships } from "@/backend/services/universe/syncSp500UniverseMemberships";
import {
  DEFAULT_UNIVERSE_KEYS,
  isUniverseKey,
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
      } else {
        unsupportedRefreshUniverseKeys.push(universeKey);
      }
    }
  }

  const tickers = await loadUniverseTickers({ universeKeys });

  return {
    universeKeys,
    refreshMode,
    refreshedUniverseKeys,
    unsupportedRefreshUniverseKeys,
    tickers,
  };
}

function normalizeUniverseKeys(value: UniverseKey[] | undefined): UniverseKey[] {
  const source = value?.length ? value : DEFAULT_UNIVERSE_KEYS;
  const unique = new Set<UniverseKey>();

  for (const key of source) {
    if (isUniverseKey(key)) {
      unique.add(key);
    }
  }

  return unique.size ? [...unique] : DEFAULT_UNIVERSE_KEYS;
}
