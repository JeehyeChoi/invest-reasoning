import { fetchFmpSp500Constituents } from "@/backend/clients/fmp";
import type { FmpSp500ConstituentRecord } from "@/backend/clients/fmp/types";
import { db } from "@/backend/config/db";

const UNIVERSE_KEY = "sp500";
const SOURCE = "fmp_sp500_constituent";

export type SyncSp500UniverseMembershipsResult = {
  universeKey: typeof UNIVERSE_KEY;
  fetchedCount: number;
  activeCount: number;
};

export async function syncSp500UniverseMemberships(): Promise<
  SyncSp500UniverseMembershipsResult
> {
  const constituents = await fetchFmpSp500Constituents();
  const normalized = normalizeConstituents(constituents);
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
      [
        UNIVERSE_KEY,
        "S&P 500",
        "fmp",
        "Large-cap U.S. equity universe sourced from FMP S&P 500 constituents.",
      ],
    );

    await client.query(
      `
      UPDATE universe_memberships
      SET is_active = false,
          updated_at = NOW()
      WHERE universe_key = $1
        AND is_active = true
      `,
      [UNIVERSE_KEY],
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
          $1, $2, $3, $4, $5, $6,
          $7, $8::jsonb, $9, NOW(), true, NOW(), NOW()
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
          UNIVERSE_KEY,
          item.ticker,
          item.companyName,
          item.sector,
          item.industry,
          item.cik,
          SOURCE,
          JSON.stringify(item.sourcePayload),
          item.effectiveDate,
        ],
      );
    }

    await client.query("COMMIT");

    return {
      universeKey: UNIVERSE_KEY,
      fetchedCount: constituents.length,
      activeCount: normalized.length,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

function normalizeConstituents(records: FmpSp500ConstituentRecord[]) {
  const byTicker = new Map<
    string,
    {
      ticker: string;
      companyName: string | null;
      sector: string | null;
      industry: string | null;
      cik: string | null;
      effectiveDate: string | null;
      sourcePayload: FmpSp500ConstituentRecord;
    }
  >();

  for (const record of records) {
    const ticker = record.symbol?.trim().toUpperCase();
    if (!ticker) continue;

    byTicker.set(ticker, {
      ticker,
      companyName: normalizeText(record.name),
      sector: normalizeText(record.sector),
      industry: normalizeText(record.subSector),
      cik: normalizeText(record.cik),
      effectiveDate: normalizeDate(record.dateFirstAdded),
      sourcePayload: record,
    });
  }

  return [...byTicker.values()].sort((a, b) => a.ticker.localeCompare(b.ticker));
}

function normalizeText(value: string | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function normalizeDate(value: string | undefined): string | null {
  const normalized = value?.trim();
  if (!normalized) return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : null;
}
