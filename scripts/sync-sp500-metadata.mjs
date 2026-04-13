import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import fs from "node:fs/promises";
import path from "node:path";
import pg from "pg";

const { Pool } = pg;

const getEnv = (key) => {
  const value = process.env[key];
  if (!value) throw new Error(`Missing env variable: ${key}`);
  return value;
};

const API_KEY = getEnv("FMP_API_KEY");
const DATABASE_URL = getEnv("DATABASE_URL");
const BASE_URL = "https://financialmodelingprep.com/stable";

const pool = new Pool({
  connectionString: DATABASE_URL,
});

const FORCE_REFRESH = process.argv.includes("--force");

async function fetchJsonWithRetry(url, maxRetries = 5) {
  let attempt = 0;

  while (true) {
    const res = await fetch(url);

    if (res.ok) {
      return res.json();
    }

    if (res.status === 429) {
      attempt += 1;

      if (attempt > maxRetries) {
        const bodyText = await res.text().catch(() => "");
        const error = new Error(`HTTP 429 Too Many Requests`);
        error.status = 429;
        error.url = url;
        error.retryCount = attempt;
        error.responseBody = bodyText;
        throw error;
      }

      const waitTime = 500 * Math.pow(2, attempt);
      console.log(`⚠️ 429 hit. retry ${attempt} after ${waitTime}ms`);
      await sleep(waitTime);
      continue;
    }

    const bodyText = await res.text().catch(() => "");
    const error = new Error(`HTTP ${res.status} ${res.statusText}`);
    error.status = res.status;
    error.url = url;
    error.responseBody = bodyText;
    throw error;
  }
}

function normalizeTicker(v) {
  return String(v ?? "").trim().toUpperCase();
}

function toNumber(v) {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function toInt(v) {
  const n = toNumber(v);
  return n == null ? null : Math.trunc(n);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function loadTickers() {
  const filePath = path.resolve("scripts", "data", "sp500-tickers.json");
  const raw = await fs.readFile(filePath, "utf-8");
  const parsed = JSON.parse(raw);
  return parsed.tickers ?? [];
}

async function tickerAlreadyExists(client, ticker) {
  const res = await client.query(
    `SELECT 1 FROM ticker_profiles WHERE ticker = $1 LIMIT 1`,
    [ticker],
  );
  return res.rowCount > 0;
}

async function upsertProfile(client, ticker, r) {
  await client.query(
    `
    INSERT INTO ticker_profiles (
      ticker, company_name, description, website, ceo,
      country, state, city, zip, address, phone,
      full_time_employees, ipo_date, source, fetched_at, updated_at
    )
    VALUES (
      $1,$2,$3,$4,$5,
      $6,$7,$8,$9,$10,$11,
      $12,$13,$14,NOW(),NOW()
    )
    ON CONFLICT (ticker)
    DO UPDATE SET
      company_name = EXCLUDED.company_name,
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
      ticker,
      r.companyName ?? null,
      r.description ?? null,
      r.website ?? null,
      r.ceo ?? null,
      r.country ?? null,
      r.state ?? null,
      r.city ?? null,
      r.zip ?? null,
      r.address ?? null,
      r.phone ?? null,
      toInt(r.fullTimeEmployees),
      r.ipoDate ?? null,
      "fmp_profile",
    ],
  );
}

async function upsertClassification(client, ticker, r) {
  await client.query(
    `
    INSERT INTO ticker_classifications (
      ticker, sector, industry, exchange, exchange_full_name,
      currency, cik, is_etf, is_fund, is_adr, is_actively_trading,
      source, fetched_at, updated_at
    )
    VALUES (
      $1,$2,$3,$4,$5,
      $6,$7,$8,$9,$10,$11,
      $12,NOW(),NOW()
    )
    ON CONFLICT (ticker)
    DO UPDATE SET
      sector = EXCLUDED.sector,
      industry = EXCLUDED.industry,
      exchange = EXCLUDED.exchange,
      exchange_full_name = EXCLUDED.exchange_full_name,
      currency = EXCLUDED.currency,
      cik = EXCLUDED.cik,
      is_etf = EXCLUDED.is_etf,
      is_fund = EXCLUDED.is_fund,
      is_adr = EXCLUDED.is_adr,
      is_actively_trading = EXCLUDED.is_actively_trading,
      source = EXCLUDED.source,
      fetched_at = NOW()
    `,
    [
      ticker,
      r.sector ?? null,
      r.industry ?? null,
      r.exchangeShortName ?? r.exchange ?? null,
      r.exchangeFullName ?? null,
      r.currency ?? null,
      r.cik ?? null,
      typeof r.isEtf === "boolean" ? r.isEtf : null,
      typeof r.isFund === "boolean" ? r.isFund : null,
      typeof r.isAdr === "boolean" ? r.isAdr : null,
      typeof r.isActivelyTrading === "boolean" ? r.isActivelyTrading : null,
      "fmp_profile",
    ],
  );
}

async function upsertMarketData(client, ticker, r) {
  await client.query(
    `
    INSERT INTO ticker_market_data (
      ticker, price, market_cap, beta, last_dividend,
      fifty_two_week_range, price_change, price_change_percentage,
      volume, average_volume, fetched_at, updated_at
    )
    VALUES (
      $1,$2,$3,$4,$5,
      $6,$7,$8,$9,$10,NOW(),NOW()
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
      fetched_at = NOW()
    `,
    [
      ticker,
      toNumber(r.price),
      toNumber(r.mktCap ?? r.marketCap),
      toNumber(r.beta),
      toNumber(r.lastDiv),
      r.range ?? null,
      toNumber(r.changes),
      toNumber(r.changesPercentage),
      toInt(r.volume),
      toInt(r.volAvg),
    ],
  );
}

async function fetchProfileForTicker(ticker) {
  const normalizedTicker = normalizeTicker(ticker);
  const url =
    `${BASE_URL}/profile` +
    `?symbol=${encodeURIComponent(normalizedTicker)}` +
    `&apikey=${API_KEY}`;

  const rows = await fetchJsonWithRetry(url);
  return Array.isArray(rows) ? rows[0] ?? null : null;
}

async function main() {
  const client = await pool.connect();

  let inserted = 0;
  let skipped = 0;
  let failed = 0;

  try {
    const tickers = await loadTickers();
    console.log(`Loaded ${tickers.length} tickers`);
    if (FORCE_REFRESH) {
      console.log("Force refresh enabled");
    }

    for (let i = 0; i < tickers.length; i++) {
      const ticker = normalizeTicker(tickers[i]);
      if (!ticker) continue;

      try {
        if (!FORCE_REFRESH) {
          const exists = await tickerAlreadyExists(client, ticker);
          if (exists) {
            skipped += 1;
            console.log(`[${i + 1}/${tickers.length}] skip ${ticker} (already exists)`);
            continue;
          }
        }

        console.log(`[${i + 1}/${tickers.length}] fetch ${ticker}`);
        const r = await fetchProfileForTicker(ticker);

        if (!r) {
          failed += 1;
          console.log(`[${i + 1}/${tickers.length}] no data for ${ticker}`);
          await sleep(300);
          continue;
        }

        await upsertProfile(client, ticker, r);
        await upsertClassification(client, ticker, r);
        await upsertMarketData(client, ticker, r);

        inserted += 1;
        console.log(`[${i + 1}/${tickers.length}] saved ${ticker}`);

        // 무료 플랜 배려용
        await sleep(300);
      } catch (error) {
        console.error(`[${i + 1}/${tickers.length}] failed ${ticker}`);
        console.error(error);

        if (error?.status === 429) {
          console.log("");
          console.log("⛔ FMP returned HTTP 429. Stopping this run.");
          console.log(`Stopped at [${i + 1}/${tickers.length}] ${ticker}`);
          if (error.url) console.log(`URL: ${error.url}`);
          if (error.responseBody) console.log(`Body: ${error.responseBody}`);
          break;
        }

        failed += 1;
        await sleep(500);
      }
    }

    console.log("");
    console.log("Done.");
    console.log(`Inserted/updated: ${inserted}`);
    console.log(`Skipped: ${skipped}`);
    console.log(`Failed: ${failed}`);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error("sync-sp500-metadata failed");
  console.error(err);
  process.exit(1);
});
