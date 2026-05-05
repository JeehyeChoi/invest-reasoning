import { loadUniverseTickers } from "@/backend/services/universe/loadUniverseTickers";
import { db } from "@/backend/config/db";
import { syncEtfUniverseMemberships } from "@/backend/services/universe/syncEtfUniverseMemberships";
import { syncSp500UniverseMemberships } from "@/backend/services/universe/syncSp500UniverseMemberships";
import {
  DEFAULT_UNIVERSE_KEYS,
  UNIVERSE_KEYS,
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
  usedTickerIdentityFallback: boolean;
};

export async function runUniverseSelectionWorkflow(
  input: RunUniverseSelectionWorkflowInput = {},
): Promise<RunUniverseSelectionWorkflowResult> {
  const universeKeys = [...UNIVERSE_KEYS];
  const refreshUniverseKeys = normalizeUniverseKeys(input.universeKeys);
  const refreshMode = input.refreshMode ?? "skip";
  const refreshedUniverseKeys: UniverseKey[] = [];
  const unsupportedRefreshUniverseKeys: UniverseKey[] = [];

  if (refreshMode === "selected") {
    for (const universeKey of refreshUniverseKeys) {
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
      } else {
        unsupportedRefreshUniverseKeys.push(universeKey);
      }
    }
  }

  let tickers = await loadUniverseTickers({ universeKeys });
  let usedTickerIdentityFallback = false;

  if (tickers.length === 0) {
    tickers = await loadTickerIdentityTickers();
    usedTickerIdentityFallback = true;
  }

  return {
    universeKeys,
    refreshMode,
    refreshedUniverseKeys,
    unsupportedRefreshUniverseKeys,
    tickers,
    usedTickerIdentityFallback,
  };
}

async function loadTickerIdentityTickers(): Promise<string[]> {
  const result = await db.query<{ ticker: string }>(
    `
      SELECT ticker
      FROM public.ticker_identities
      WHERE cik IS NOT NULL
      ORDER BY ticker
    `,
  );

  return result.rows.map((row) => row.ticker);
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
