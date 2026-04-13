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

const pool = new Pool({
  connectionString: getEnv("DATABASE_URL"),
});

// ------------------ utils ------------------

function slugify(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function toNumber(v) {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// ------------------ buckets ------------------

function marketCapBucket(n) {
  n = toNumber(n);
  if (!n) return null;
  if (n >= 200e9) return "megacap";
  if (n >= 10e9) return "largecap";
  if (n >= 2e9) return "midcap";
  return "smallcap";
}

function betaBucket(n) {
  n = toNumber(n);
  if (n == null) return null;
  if (n < 0.8) return "low_beta";
  if (n <= 1.2) return "mid_beta";
  return "high_beta";
}

function dividendBucket(div, price) {
  div = toNumber(div);
  price = toNumber(price);
  if (!div || !price || price <= 0) return null;

  const y = div / price;

  if (y === 0) return "non_dividend";
  if (y >= 0.03) return "high_dividend";
  if (y >= 0.01) return "mid_dividend";
  return "low_dividend";
}

// ------------------ main ------------------

async function main() {
  const client = await pool.connect();

  try {
    const { rows } = await client.query(`
      SELECT
        p.ticker,
        c.sector,
        c.industry,
        c.is_adr,
        c.is_etf,
        c.is_actively_trading,
        m.market_cap,
        m.beta,
        m.last_dividend,
        m.price
      FROM ticker_profiles p
      LEFT JOIN ticker_classifications c ON c.ticker = p.ticker
      LEFT JOIN ticker_market_data m ON m.ticker = p.ticker
    `);

    const map = new Map();

    function add(key, name, category) {
      if (!key) return;

      const existing = map.get(key);

      if (!existing) {
        map.set(key, {
          key,
          name,
          category,
          count: 1,
        });
      } else {
        existing.count += 1;
      }
    }

    for (const r of rows) {
      // -------- sector --------
      if (r.sector) {
        add(slugify(r.sector), r.sector, "sector");
      }

      // -------- industry --------
      if (r.industry) {
        add(slugify(r.industry), r.industry, "industry");
      }

      // -------- listing --------
      if (r.is_adr) add("adr", "ADR", "listing");
      if (r.is_etf) add("etf", "ETF", "listing");
      if (r.is_actively_trading)
        add("actively_trading", "Actively Trading", "listing");

      // -------- market buckets --------
      const cap = marketCapBucket(r.market_cap);
      if (cap) add(cap, cap, "size_style");

      const beta = betaBucket(r.beta);
      if (beta) add(beta, beta, "risk_style");

      const div = dividendBucket(r.last_dividend, r.price);
      if (div) add(div, div, "income_style");
    }

    const result = Array.from(map.values()).sort((a, b) => {
      if (a.category !== b.category)
        return a.category.localeCompare(b.category);
      return a.key.localeCompare(b.key);
    });

		const outputDir = path.resolve("scripts", "data");
		await fs.mkdir(outputDir, { recursive: true });

		const outputPath = path.join(outputDir, "tag-definition-candidates.json");

		await fs.writeFile(
			outputPath,
			JSON.stringify(result, null, 2),
		);

		console.log(`✅ saved ${result.length} tag candidates to ${outputPath}`);

   } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error("extract-tag-definition-candidates failed");
  console.error(error);
  process.exit(1);
});
