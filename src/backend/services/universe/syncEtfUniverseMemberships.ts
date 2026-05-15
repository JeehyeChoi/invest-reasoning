import {
  fetchIsharesIjhHoldings,
  fetchIsharesIjrHoldings,
  fetchIsharesIvvHoldings,
  fetchSsgaDiaHoldings,
} from "@/backend/clients/etfHoldings";
import type { EtfHoldingRecord } from "@/backend/clients/etfHoldings/types";
import { db } from "@/backend/config/db";
import type { UniverseKey } from "@/shared/universe/universes";

type EtfUniverseKey = Extract<
  UniverseKey,
  "sp500" | "sp400" | "sp600" | "djia"
>;

type EtfUniverseSource = {
  universeKey: EtfUniverseKey;
  name: string;
  provider: string;
  description: string;
  source: string;
  fetchHoldings: () => Promise<EtfHoldingRecord[]>;
};

const ETF_UNIVERSE_SOURCES = {
  sp500: {
    universeKey: "sp500",
    name: "S&P 500",
    provider: "ishares",
    description:
      "Large-cap U.S. equity universe approximated from iShares IVV daily ETF holdings.",
    source: "ishares_ivv_holdings",
    fetchHoldings: fetchIsharesIvvHoldings,
  },
  sp400: {
    universeKey: "sp400",
    name: "S&P MidCap 400",
    provider: "ishares",
    description:
      "Mid-cap U.S. equity universe approximated from iShares IJH daily ETF holdings.",
    source: "ishares_ijh_holdings",
    fetchHoldings: fetchIsharesIjhHoldings,
  },
  sp600: {
    universeKey: "sp600",
    name: "S&P SmallCap 600",
    provider: "ishares",
    description:
      "Small-cap U.S. equity universe approximated from iShares IJR daily ETF holdings.",
    source: "ishares_ijr_holdings",
    fetchHoldings: fetchIsharesIjrHoldings,
  },
  djia: {
    universeKey: "djia",
    name: "Dow Jones Industrial Average",
    provider: "ssga",
    description:
      "Dow Jones Industrial Average universe approximated from State Street DIA daily ETF holdings.",
    source: "ssga_dia_holdings",
    fetchHoldings: fetchSsgaDiaHoldings,
  },
} as const satisfies Record<EtfUniverseKey, EtfUniverseSource>;

export type SyncEtfUniverseMembershipsResult = {
  universeKey: EtfUniverseKey;
  fetchedCount: number;
  activeCount: number;
};

export async function syncEtfUniverseMemberships(
  universeKey: EtfUniverseKey,
): Promise<SyncEtfUniverseMembershipsResult> {
  const source = ETF_UNIVERSE_SOURCES[universeKey];
  const holdings = await source.fetchHoldings();
  const normalized = normalizeHoldings(holdings);
  const client = await db.connect();

  try {
    await client.query("BEGIN");

    await client.query(
      `
      INSERT INTO universes (
        key,
        name,
        provider,
        description,
        is_active,
        created_at,
        updated_at
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        true,
        NOW(),
        NOW()
      )
      ON CONFLICT (key)
      DO UPDATE SET
        name = EXCLUDED.name,
        provider = EXCLUDED.provider,
        description = EXCLUDED.description,
        is_active = true,
        updated_at = NOW()
      `,
      [source.universeKey, source.name, source.provider, source.description],
    );

    await client.query(
      `
      UPDATE universe_memberships
      SET is_active = false,
          updated_at = NOW()
      WHERE universe_key = $1
        AND is_active = true
      `,
      [source.universeKey],
    );

    for (const item of normalized) {
      await client.query(
        `
        INSERT INTO universe_memberships (
          universe_key,
          ticker,
          company_name,
          sector,
          industry,
          cik,
          source,
          source_payload,
          effective_date,
          fetched_at,
          is_active,
          created_at,
          updated_at
        )
        VALUES (
          $1, $2, $3, $4, $5, NULL,
          $6, $7::jsonb, NULL, NOW(), true, NOW(), NOW()
        )
        ON CONFLICT (universe_key, ticker)
        DO UPDATE SET
          company_name = EXCLUDED.company_name,
          sector = EXCLUDED.sector,
          industry = EXCLUDED.industry,
          cik = EXCLUDED.cik,
          source = EXCLUDED.source,
          source_payload = EXCLUDED.source_payload,
          effective_date = EXCLUDED.effective_date,
          fetched_at = NOW(),
          is_active = true,
          updated_at = NOW()
        `,
        [
          source.universeKey,
          item.ticker,
          item.companyName,
          item.sector,
          item.industry,
          source.source,
          JSON.stringify(item.sourcePayload),
        ],
      );
    }

    await client.query("COMMIT");

    return {
      universeKey: source.universeKey,
      fetchedCount: holdings.length,
      activeCount: normalized.length,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

function normalizeHoldings(records: EtfHoldingRecord[]) {
  const byTicker = new Map<
    string,
    {
      ticker: string;
      companyName: string | null;
      sector: string | null;
      industry: string | null;
      sourcePayload: EtfHoldingRecord["sourcePayload"];
    }
  >();

  for (const record of records) {
    const ticker = resolveEtfUniverseTicker(record);
    if (!ticker || ticker === "-" || ticker === "USD") continue;
    if (!isTickerLike(ticker)) continue;

    const assetClass = normalizeText(record.assetClass)?.toLowerCase();
    const exchange = normalizeText(record.exchange)?.toLowerCase();

    if (assetClass && assetClass !== "equity") continue;
    if (exchange === "cash") continue;

    byTicker.set(ticker, {
      ticker,
      companyName: normalizeText(record.name),
      sector: normalizeText(record.sector),
      industry: normalizeText(record.industry),
      sourcePayload: record.sourcePayload,
    });
  }

  return [...byTicker.values()].sort((a, b) => a.ticker.localeCompare(b.ticker));
}

function resolveEtfUniverseTicker(record: EtfHoldingRecord): string {
  const ticker = record.ticker.trim().toUpperCase();
  const compactShareClassTicker = resolveCompactShareClassTicker(
    ticker,
    record.name,
  );

  return compactShareClassTicker ?? ticker;
}

function resolveCompactShareClassTicker(
  ticker: string,
  companyName: string | undefined,
): string | null {
  const shareClass = companyName?.match(/\bCLASS\s+([A-C])\b/i)?.[1]?.toUpperCase();

  if (!shareClass || !ticker.endsWith(shareClass)) return null;
  if (!/^[A-Z]{3,5}$/.test(ticker)) return null;

  const baseTicker = ticker.slice(0, -1);
  if (baseTicker.length < 2 || baseTicker.length > 4) return null;

  return `${baseTicker}-${shareClass}`;
}

function normalizeText(value: string | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function isTickerLike(value: string): boolean {
  return /^[A-Z][A-Z0-9.-]{0,9}$/.test(value);
}
