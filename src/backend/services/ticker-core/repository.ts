import { db } from "@/backend/config/db";
import type { UniverseKey } from "@/shared/universe/universes";
import type { TickerCoreRows } from "@/backend/services/ticker-core/types";

export type FindTickerCoreSyncCandidatesInput = {
  universeKeys: UniverseKey[];
  staleAfterDays: number;
  limit: number;
};

export async function findTickerCoreSyncCandidates(
  input: FindTickerCoreSyncCandidatesInput,
): Promise<string[]> {
  const result = await db.query<{ ticker: string }>(
    `
    SELECT DISTINCT
      u.ticker,
      CASE
        WHEN i.ticker IS NULL
          OR p.ticker IS NULL
          OR c.ticker IS NULL
          OR m.ticker IS NULL
        THEN 0
        ELSE 1
      END AS priority,
      LEAST(
        COALESCE(i.fetched_at, TIMESTAMP 'epoch'),
        COALESCE(p.fetched_at, TIMESTAMP 'epoch'),
        COALESCE(c.fetched_at, TIMESTAMP 'epoch')
      ) AS oldest_fetched_at
    FROM universe_memberships u
    LEFT JOIN ticker_identities i
      ON i.ticker = u.ticker
    LEFT JOIN ticker_company_profiles p
      ON p.ticker = u.ticker
    LEFT JOIN ticker_company_classifications c
      ON c.ticker = u.ticker
    LEFT JOIN ticker_market_snapshots m
      ON m.ticker = u.ticker
    WHERE u.universe_key = ANY($1::text[])
      AND u.is_active = true
      AND (
        i.ticker IS NULL
        OR p.ticker IS NULL
        OR c.ticker IS NULL
        OR m.ticker IS NULL
        OR i.fetched_at < NOW() - ($2::int * INTERVAL '1 day')
        OR p.fetched_at < NOW() - ($2::int * INTERVAL '1 day')
        OR c.fetched_at < NOW() - ($2::int * INTERVAL '1 day')
      )
    ORDER BY priority, oldest_fetched_at, u.ticker
    LIMIT $3
    `,
    [input.universeKeys, input.staleAfterDays, input.limit],
  );

  return result.rows.map((row) => row.ticker);
}

export async function upsertTickerCoreRows(rows: TickerCoreRows): Promise<void> {
  const client = await db.connect();

  try {
    await client.query("BEGIN");

    await client.query(
      `
      INSERT INTO ticker_identities (
        ticker,
        cik,
        company_name,
        exchange,
        exchange_full_name,
        source,
        fetched_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
      ON CONFLICT (ticker)
      DO UPDATE SET
        cik = COALESCE(EXCLUDED.cik, ticker_identities.cik),
        company_name = COALESCE(EXCLUDED.company_name, ticker_identities.company_name),
        exchange = COALESCE(EXCLUDED.exchange, ticker_identities.exchange),
        exchange_full_name = COALESCE(EXCLUDED.exchange_full_name, ticker_identities.exchange_full_name),
        source = EXCLUDED.source,
        fetched_at = NOW()
      `,
      [
        rows.identity.ticker,
        rows.identity.cik,
        rows.identity.companyName,
        rows.identity.exchange,
        rows.identity.exchangeFullName,
        rows.identity.source,
      ],
    );

    await client.query(
      `
      INSERT INTO ticker_company_profiles (
        ticker,
        description,
        website,
        ceo,
        country,
        state,
        city,
        zip,
        address,
        phone,
        full_time_employees,
        ipo_date,
        source,
        fetched_at,
        updated_at
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8,
        $9, $10, $11, $12, $13, NOW(), NOW()
      )
      ON CONFLICT (ticker)
      DO UPDATE SET
        description = EXCLUDED.description,
        website = EXCLUDED.website,
        ceo = EXCLUDED.ceo,
        country = EXCLUDED.country,
        state = EXCLUDED.state,
        city = EXCLUDED.city,
        zip = EXCLUDED.zip,
        address = EXCLUDED.address,
        phone = EXCLUDED.phone,
        full_time_employees = EXCLUDED.full_time_employees,
        ipo_date = EXCLUDED.ipo_date,
        source = EXCLUDED.source,
        fetched_at = NOW()
      `,
      [
        rows.profile.ticker,
        rows.profile.description,
        rows.profile.website,
        rows.profile.ceo,
        rows.profile.country,
        rows.profile.state,
        rows.profile.city,
        rows.profile.zip,
        rows.profile.address,
        rows.profile.phone,
        rows.profile.fullTimeEmployees,
        rows.profile.ipoDate,
        rows.profile.source,
      ],
    );

    await client.query(
      `
      INSERT INTO ticker_company_classifications (
        ticker,
        sector,
        industry,
        currency,
        cusip,
        isin,
        is_etf,
        is_fund,
        is_adr,
        is_actively_trading,
        source,
        fetched_at,
        updated_at
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7,
        $8, $9, $10, $11, NOW(), NOW()
      )
      ON CONFLICT (ticker)
      DO UPDATE SET
        sector = EXCLUDED.sector,
        industry = EXCLUDED.industry,
        currency = EXCLUDED.currency,
        cusip = EXCLUDED.cusip,
        isin = EXCLUDED.isin,
        is_etf = EXCLUDED.is_etf,
        is_fund = EXCLUDED.is_fund,
        is_adr = EXCLUDED.is_adr,
        is_actively_trading = EXCLUDED.is_actively_trading,
        source = EXCLUDED.source,
        fetched_at = NOW()
      `,
      [
        rows.classification.ticker,
        rows.classification.sector,
        rows.classification.industry,
        rows.classification.currency,
        rows.classification.cusip,
        rows.classification.isin,
        rows.classification.isEtf,
        rows.classification.isFund,
        rows.classification.isAdr,
        rows.classification.isActivelyTrading,
        rows.classification.source,
      ],
    );

    await client.query(
      `
      INSERT INTO ticker_market_snapshots (
        ticker,
        price,
        market_cap,
        beta,
        last_dividend,
        fifty_two_week_range,
        price_change,
        price_change_percentage,
        volume,
        average_volume,
        snapshot_date,
        source,
        fetched_at,
        updated_at
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7,
        $8, $9, $10, CURRENT_DATE, $11, NOW(), NOW()
      )
      ON CONFLICT (ticker)
      DO UPDATE SET
        price = EXCLUDED.price,
        market_cap = EXCLUDED.market_cap,
        beta = EXCLUDED.beta,
        last_dividend = EXCLUDED.last_dividend,
        fifty_two_week_range = EXCLUDED.fifty_two_week_range,
        price_change = EXCLUDED.price_change,
        price_change_percentage = EXCLUDED.price_change_percentage,
        volume = EXCLUDED.volume,
        average_volume = EXCLUDED.average_volume,
        snapshot_date = EXCLUDED.snapshot_date,
        source = EXCLUDED.source,
        fetched_at = NOW()
      `,
      [
        rows.marketSnapshot.ticker,
        rows.marketSnapshot.price,
        rows.marketSnapshot.marketCap,
        rows.marketSnapshot.beta,
        rows.marketSnapshot.lastDividend,
        rows.marketSnapshot.fiftyTwoWeekRange,
        rows.marketSnapshot.priceChange,
        rows.marketSnapshot.priceChangePercentage,
        rows.marketSnapshot.volume,
        rows.marketSnapshot.averageVolume,
        rows.marketSnapshot.source,
      ],
    );

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
