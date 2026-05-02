import { db } from "@/backend/config/db";
import type {
  TickerClassificationRow,
  TickerMarketDataRow,
  TickerProfileRow,
  TickerTagRow,
} from "@/backend/services/metadata/types";

export async function getTickerBundle(ticker: string) {
  const profileRes = await db.query(
    `
    SELECT
      i.ticker,
      i.company_name,
      p.description,
      p.website,
      p.ceo,
      p.country,
      p.state,
      p.city,
      p.zip,
      p.address,
      p.phone,
      p.full_time_employees,
      p.ipo_date,
      COALESCE(p.source, i.source) AS source,
      COALESCE(p.fetched_at, i.fetched_at) AS fetched_at,
      COALESCE(p.updated_at, i.updated_at) AS updated_at
    FROM ticker_identities i
    LEFT JOIN ticker_company_profiles p
      ON p.ticker = i.ticker
    WHERE i.ticker = $1
    `,
    [ticker],
  );

  if (profileRes.rowCount === 0) {
    return null;
  }

  const classificationRes = await db.query(
    `
    SELECT
      i.ticker,
      c.sector,
      c.industry,
      i.exchange,
      i.exchange_full_name,
      c.currency,
      i.cik,
      c.cusip,
      c.isin,
      c.is_etf,
      c.is_fund,
      c.is_adr,
      c.is_actively_trading,
      COALESCE(c.source, i.source) AS source,
      COALESCE(c.fetched_at, i.fetched_at) AS fetched_at,
      COALESCE(c.updated_at, i.updated_at) AS updated_at
    FROM ticker_identities i
    LEFT JOIN ticker_company_classifications c
      ON c.ticker = i.ticker
    WHERE i.ticker = $1
    `,
    [ticker],
  );

  const marketDataRes = await db.query(
    `SELECT * FROM ticker_market_snapshots WHERE ticker = $1`,
    [ticker],
  );

  const tagsRes = await db.query(
    `SELECT tag, source_rule, inferred_at
     FROM ticker_tags
     WHERE ticker = $1
     ORDER BY tag ASC`,
    [ticker],
  );

  return {
    profile: profileRes.rows[0],
    classification: classificationRes.rows[0] ?? null,
    marketData: marketDataRes.rows[0] ?? null,
    tags: tagsRes.rows,
  };
}

export async function upsertTickerProfile(row: TickerProfileRow) {
  await db.query(
    `
    INSERT INTO ticker_identities (
      ticker, company_name, source, fetched_at, updated_at
    )
    VALUES ($1, $2, $3, NOW(), NOW())
    ON CONFLICT (ticker)
    DO UPDATE SET
      company_name = EXCLUDED.company_name,
      source = EXCLUDED.source,
      fetched_at = NOW()
    `,
    [row.ticker, row.company_name, row.source],
  );

  await db.query(
    `
    INSERT INTO ticker_company_profiles (
      ticker, description, website, ceo,
      country, state, city, zip, address, phone,
      full_time_employees, ipo_date, source, fetched_at, updated_at
    )
    VALUES (
      $1,$2,$3,$4,
      $5,$6,$7,$8,$9,$10,
      $11,$12,$13,NOW(),NOW()
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
      row.ticker,
      row.description,
      row.website,
      row.ceo,
      row.country,
      row.state,
      row.city,
      row.zip,
      row.address,
      row.phone,
      row.full_time_employees,
      row.ipo_date,
      row.source,
    ],
  );
}

export async function upsertTickerClassification(row: TickerClassificationRow) {
  await db.query(
    `
    INSERT INTO ticker_identities (
      ticker, cik, exchange, exchange_full_name, source, fetched_at, updated_at
    )
    VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
    ON CONFLICT (ticker)
    DO UPDATE SET
      cik = COALESCE(EXCLUDED.cik, ticker_identities.cik),
      exchange = COALESCE(EXCLUDED.exchange, ticker_identities.exchange),
      exchange_full_name = COALESCE(
        EXCLUDED.exchange_full_name,
        ticker_identities.exchange_full_name
      ),
      source = EXCLUDED.source,
      fetched_at = NOW()
    `,
    [
      row.ticker,
      row.cik,
      row.exchange,
      row.exchange_full_name,
      row.source,
    ],
  );

  await db.query(
    `
    INSERT INTO ticker_company_classifications (
      ticker, sector, industry, currency,
      is_etf, is_fund, is_adr, is_actively_trading,
      source, fetched_at, updated_at
    )
    VALUES (
      $1,$2,$3,$4,
      $5,$6,$7,$8,
      $9,NOW(),NOW()
    )
    ON CONFLICT (ticker)
    DO UPDATE SET
      sector = EXCLUDED.sector,
      industry = EXCLUDED.industry,
      currency = EXCLUDED.currency,
      is_etf = EXCLUDED.is_etf,
      is_fund = EXCLUDED.is_fund,
      is_adr = EXCLUDED.is_adr,
      is_actively_trading = EXCLUDED.is_actively_trading,
      source = EXCLUDED.source,
      fetched_at = NOW()
    `,
    [
      row.ticker,
      row.sector,
      row.industry,
      row.currency,
      row.is_etf,
      row.is_fund,
      row.is_adr,
      row.is_actively_trading,
      row.source,
    ],
  );
}

export async function upsertTickerMarketData(row: TickerMarketDataRow) {
  await db.query(
    `
    INSERT INTO ticker_market_snapshots (
      ticker, price, market_cap, beta, last_dividend,
      fifty_two_week_range, price_change, price_change_percentage,
      volume, average_volume, snapshot_date, source, fetched_at, updated_at
    )
    VALUES (
      $1,$2,$3,$4,$5,
      $6,$7,$8,$9,$10,CURRENT_DATE,$11,NOW(),NOW()
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
      row.ticker,
      row.price,
      row.market_cap,
      row.beta,
      row.last_dividend,
      row.fifty_two_week_range,
      row.price_change,
      row.price_change_percentage,
      row.volume,
      row.average_volume,
      row.source,
    ],
  );
}

export async function replaceTickerTags(
  ticker: string,
  tags: TickerTagRow[],
) {
  await db.query(`DELETE FROM ticker_tags WHERE ticker = $1`, [ticker]);

  for (const item of tags) {
    await db.query(
      `
      INSERT INTO ticker_tags (ticker, tag, source_rule, inferred_at)
      VALUES ($1, $2, $3, NOW())
      ON CONFLICT (ticker, tag)
      DO UPDATE SET
        source_rule = EXCLUDED.source_rule,
        inferred_at = NOW()
      `,
      [ticker, item.tag, item.source_rule],
    );
  }
}
