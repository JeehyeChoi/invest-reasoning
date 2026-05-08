import { db } from "@/backend/config/db";

export type TickerProviderSymbolStatus =
  | "verified"
  | "unresolved"
  | "disabled";

export type TickerProviderSymbolRow = {
  ticker: string;
  provider: string;
  providerSymbol: string | null;
  exchange: string | null;
  country: string | null;
  instrumentType: string | null;
  micCode: string | null;
  status: TickerProviderSymbolStatus;
  source: string;
  candidateSymbols: string[];
  metadata: unknown;
  lastError: string | null;
};

type DbTickerProviderSymbolRow = {
  ticker: string;
  provider: string;
  provider_symbol: string | null;
  exchange: string | null;
  country: string | null;
  instrument_type: string | null;
  mic_code: string | null;
  status: TickerProviderSymbolStatus;
  source: string;
  candidate_symbols: unknown;
  metadata: unknown;
  last_error: string | null;
};

export async function getTickerProviderSymbol(input: {
  ticker: string;
  provider: string;
}): Promise<TickerProviderSymbolRow | null> {
  const result = await db.query<DbTickerProviderSymbolRow>(
    `
    SELECT
      ticker,
      provider,
      provider_symbol,
      exchange,
      country,
      instrument_type,
      mic_code,
      status,
      source,
      candidate_symbols,
      metadata,
      last_error
    FROM public.ticker_provider_symbols
    WHERE ticker = $1
      AND provider = $2
    LIMIT 1
    `,
    [input.ticker, input.provider],
  );

  const row = result.rows[0];
  return row ? mapTickerProviderSymbolRow(row) : null;
}

export async function upsertTickerProviderSymbol(input: {
  ticker: string;
  provider: string;
  providerSymbol: string | null;
  exchange?: string | null;
  country?: string | null;
  instrumentType?: string | null;
  micCode?: string | null;
  status: TickerProviderSymbolStatus;
  source?: string;
  candidateSymbols?: string[];
  metadata?: unknown;
  lastError?: string | null;
}): Promise<void> {
  await db.query(
    `
    INSERT INTO public.ticker_provider_symbols (
      ticker,
      provider,
      provider_symbol,
      exchange,
      mic_code,
      country,
      instrument_type,
      status,
      source,
      candidate_symbols,
      metadata,
      last_error,
      verified_at
    )
    VALUES (
      $1,
      $2,
      $3,
      $4,
      $5,
      $6,
      $7,
      $8,
      $9,
      $10::jsonb,
      $11::jsonb,
      $12,
      CASE WHEN $8 = 'verified' THEN now() ELSE NULL END
    )
    ON CONFLICT (ticker, provider)
    DO UPDATE SET
      provider_symbol = EXCLUDED.provider_symbol,
      exchange = EXCLUDED.exchange,
      mic_code = EXCLUDED.mic_code,
      country = EXCLUDED.country,
      instrument_type = EXCLUDED.instrument_type,
      status = EXCLUDED.status,
      source = EXCLUDED.source,
      candidate_symbols = EXCLUDED.candidate_symbols,
      metadata = EXCLUDED.metadata,
      last_error = EXCLUDED.last_error,
      verified_at = CASE
        WHEN EXCLUDED.status = 'verified' THEN now()
        ELSE ticker_provider_symbols.verified_at
      END,
      fetched_at = now(),
      updated_at = now()
    `,
    [
      input.ticker,
      input.provider,
      input.providerSymbol,
      input.exchange ?? null,
      input.micCode ?? null,
      input.country ?? null,
      input.instrumentType ?? null,
      input.status,
      input.source ?? "auto",
      JSON.stringify(input.candidateSymbols ?? []),
      JSON.stringify(isPlainObject(input.metadata) ? input.metadata : {}),
      input.lastError ?? null,
    ],
  );
}

function mapTickerProviderSymbolRow(
  row: DbTickerProviderSymbolRow,
): TickerProviderSymbolRow {
  return {
    ticker: row.ticker,
    provider: row.provider,
    providerSymbol: row.provider_symbol,
    exchange: row.exchange,
    country: row.country,
    instrumentType: row.instrument_type,
    micCode: row.mic_code,
    status: row.status,
    source: row.source,
    candidateSymbols: normalizeCandidateSymbols(row.candidate_symbols),
    metadata: row.metadata,
    lastError: row.last_error,
  };
}

function normalizeCandidateSymbols(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return value.filter((item): item is string => typeof item === "string");
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
