import { db } from "@/backend/config/db";
import type {
  DailyPriceAdjustmentPolicy,
  DailyPriceProviderKey,
  TickerDailyPriceRow,
  TickerDailyPriceSyncState,
  TickerDailyPriceSyncStatus,
} from "@/backend/services/market/history/types";
import type { UniverseKey } from "@/shared/universe/universes";

export type FindTickerDailyPriceSyncCandidatesInput = {
  universeKeys: UniverseKey[];
  provider: DailyPriceProviderKey;
  adjustmentPolicy: DailyPriceAdjustmentPolicy;
  targetEndDate: string;
  limit: number;
};

export async function findTickerDailyPriceSyncCandidates({
  universeKeys,
  provider,
  adjustmentPolicy,
  targetEndDate,
  limit,
}: FindTickerDailyPriceSyncCandidatesInput): Promise<string[]> {
  const result = await db.query<{ ticker: string }>(
    `
    SELECT DISTINCT u.ticker
    FROM public.universe_memberships u
    LEFT JOIN public.ticker_daily_price_sync_state s
      ON s.ticker = u.ticker
      AND s.provider = $2
      AND s.adjustment_policy = $3
    LEFT JOIN public.ticker_provider_symbols ps
      ON ps.ticker = u.ticker
      AND ps.provider = $2
    WHERE u.universe_key = ANY($1::text[])
      AND u.is_active = true
      AND u.ticker ~ '^[A-Z][A-Z0-9.-]{0,9}$'
      AND NOT (
        ps.status = 'disabled'
        AND ps.source <> 'auto_skip_share_class'
      )
      AND (
        s.ticker IS NULL
        OR s.status IN ('pending', 'partial', 'failed', 'no_data')
        OR s.latest_price_date IS NULL
        OR s.latest_price_date < ($4::date - INTERVAL '7 days')
    )
    ORDER BY u.ticker
    LIMIT $5
    `,
    [universeKeys, provider, adjustmentPolicy, targetEndDate, limit],
  );

  return result.rows.map((row) => row.ticker);
}

export async function upsertTickerDailyPriceRows(
  rows: TickerDailyPriceRow[],
): Promise<number> {
  if (rows.length === 0) {
    return 0;
  }

  for (let index = 0; index < rows.length; index += UPSERT_CHUNK_SIZE) {
    await upsertTickerDailyPriceRowsChunk(
      rows.slice(index, index + UPSERT_CHUNK_SIZE),
    );
  }

  return rows.length;
}

const UPSERT_CHUNK_SIZE = 500;

async function upsertTickerDailyPriceRowsChunk(
  rows: TickerDailyPriceRow[],
): Promise<void> {
  const values: unknown[] = [];
  const placeholders = rows.map((row, index) => {
    const offset = index * 11;

    values.push(
      row.ticker,
      row.provider,
      row.providerSymbol,
      row.priceDate,
      row.open,
      row.high,
      row.low,
      row.close,
      row.volume,
      row.adjustmentPolicy,
      row.sourcePayload === undefined ? null : JSON.stringify(row.sourcePayload),
    );

    return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8}, $${offset + 9}, $${offset + 10}, $${offset + 11})`;
  });

  await db.query(
    `
    INSERT INTO public.ticker_daily_prices (
      ticker,
      provider,
      provider_symbol,
      price_date,
      open,
      high,
      low,
      close,
      volume,
      adjustment_policy,
      source_payload
    )
    VALUES ${placeholders.join(", ")}
    ON CONFLICT (ticker, provider, adjustment_policy, price_date)
    DO UPDATE SET
      provider_symbol = EXCLUDED.provider_symbol,
      open = EXCLUDED.open,
      high = EXCLUDED.high,
      low = EXCLUDED.low,
      close = EXCLUDED.close,
      volume = EXCLUDED.volume,
      source_payload = EXCLUDED.source_payload,
      fetched_at = now(),
      updated_at = now()
    `,
    values,
  );
}

export async function upsertTickerDailyPriceSyncState(input: {
  ticker: string;
  provider: DailyPriceProviderKey | string;
  adjustmentPolicy: DailyPriceAdjustmentPolicy | string;
  providerSymbol: string | null;
  targetStartDate: string;
  status: TickerDailyPriceSyncStatus;
  lastError?: string | null;
}): Promise<TickerDailyPriceSyncState> {
  const result = await db.query<TickerDailyPriceSyncState>(
    `
    WITH stats AS (
      SELECT
        MIN(price_date) AS earliest_price_date,
        MAX(price_date) AS latest_price_date,
        COUNT(*)::integer AS row_count
      FROM public.ticker_daily_prices
      WHERE ticker = $1
        AND provider = $2
        AND adjustment_policy = $3
    ),
    upserted AS (
      INSERT INTO public.ticker_daily_price_sync_state (
        ticker,
        provider,
        adjustment_policy,
        provider_symbol,
        target_start_date,
        earliest_price_date,
        latest_price_date,
        row_count,
        status,
        last_error
      )
      SELECT
        $1,
        $2,
        $3,
        $4,
        $5::date,
        stats.earliest_price_date,
        stats.latest_price_date,
        stats.row_count,
        $6,
        $7
      FROM stats
      ON CONFLICT (ticker, provider, adjustment_policy)
      DO UPDATE SET
        provider_symbol = EXCLUDED.provider_symbol,
        target_start_date = EXCLUDED.target_start_date,
        earliest_price_date = EXCLUDED.earliest_price_date,
        latest_price_date = EXCLUDED.latest_price_date,
        row_count = EXCLUDED.row_count,
        status = EXCLUDED.status,
        last_error = EXCLUDED.last_error,
        fetched_at = now(),
        updated_at = now()
      RETURNING
        ticker,
        provider,
        adjustment_policy AS "adjustmentPolicy",
        provider_symbol AS "providerSymbol",
        target_start_date::text AS "targetStartDate",
        earliest_price_date::text AS "earliestPriceDate",
        latest_price_date::text AS "latestPriceDate",
        row_count AS "rowCount",
        status,
        last_error AS "lastError"
    )
    SELECT * FROM upserted
    `,
    [
      input.ticker,
      input.provider,
      input.adjustmentPolicy,
      input.providerSymbol,
      input.targetStartDate,
      input.status,
      input.lastError ?? null,
    ],
  );

  return result.rows[0];
}
