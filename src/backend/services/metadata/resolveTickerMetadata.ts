import { fetchUsMarketHolidays } from "@/backend/services/market/fetchUsMarketHolidays";
import { fetchTickerProfile } from "@/backend/services/metadata/fetchTickerProfile";
import { inferTickerTags } from "@/backend/services/metadata/inferTickerTags";
import {
  getTickerBundle,
  replaceTickerTags,
  upsertTickerClassification,
  upsertTickerMarketData,
  upsertTickerProfile,
} from "@/backend/services/metadata/tickerRepository";
import { shouldRefreshDailyMarketData } from "@/backend/utils/usMarketCalendar";
import {
  mapToClassificationRow,
  mapToMarketDataRow,
  mapToProfileRow,
} from "@/backend/utils/mapTickerProfile";

function normalizeTicker(ticker: string): string {
  return ticker.trim().toUpperCase();
}

export async function resolveTickerMetadata(ticker: string) {
  if (typeof ticker !== "string") {
    throw new Error(
      `resolveTickerMetadata expected string ticker, got ${typeof ticker}: ${JSON.stringify(ticker)}`,
    );
  }

  const normalizedTicker = normalizeTicker(ticker);

  if (!normalizedTicker) {
    throw new Error("resolveTickerMetadata received an empty ticker");
  }

	const existing = await getTickerBundle(normalizedTicker);

	if (existing) {
		const tagsMissing = !existing.tags || existing.tags.length === 0;

		const holidays = await fetchUsMarketHolidays();
		const marketDataNeedsRefresh = shouldRefreshDailyMarketData(
			existing.marketData?.updated_at,
			holidays,
		);

		if (!marketDataNeedsRefresh && !tagsMissing) {
			return {
				...existing,
				source: "database" as const,
			};
		}
	}

  const raw = await fetchTickerProfile(normalizedTicker);

  const profileRow = mapToProfileRow(raw);
  const classificationRow = mapToClassificationRow(raw);
  const marketDataRow = mapToMarketDataRow(raw);
  const tags = inferTickerTags(raw);
	//console.log("[infer tags]", ticker, tags);

  // FMP profile endpoint returns profile, classification, and market-like fields together.
  // When market data is stale or missing, refresh the full snapshot and re-upsert all derived tables.
  await upsertTickerProfile(profileRow);
  await upsertTickerClassification(classificationRow);
  await upsertTickerMarketData(marketDataRow);
  await replaceTickerTags(normalizedTicker, tags);

  const saved = await getTickerBundle(normalizedTicker);

  if (!saved) {
    throw new Error(
      `Failed to load saved ticker metadata for ${normalizedTicker} after upsert`,
    );
  }

  return {
    ...saved,
    source: "provider" as const,
  };
}
