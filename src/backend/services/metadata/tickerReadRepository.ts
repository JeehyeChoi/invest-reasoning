import { db } from "@/backend/config/db";
import { normalizeTickers } from "@/shared/utils/tickers";

export type TickerProfileSummary = {
  ticker: string;
  companyName: string | null;
  cik: string | null;
};

type TickerProfileSummaryRow = {
  ticker: string;
  company_name: string | null;
  cik: string | null;
};

export async function getTickerProfilesByTickers(
  tickers: string[]
): Promise<TickerProfileSummary[]> {
  const normalizedTickers = normalizeTickers(tickers);

  if (normalizedTickers.length === 0) {
    return [];
  }

  const query = `
    SELECT
      p.ticker,
      p.company_name,
      c.cik
    FROM ticker_profiles p
    LEFT JOIN ticker_classifications c
      ON c.ticker = p.ticker
    WHERE p.ticker = ANY($1::text[])
  `;

  const { rows } = await db.query<TickerProfileSummaryRow>(query, [
    normalizedTickers,
  ]);

  const byTicker = new Map<string, TickerProfileSummary>(
    rows.map((row) => [
      row.ticker.toUpperCase(),
      {
        ticker: row.ticker.toUpperCase(),
        companyName: row.company_name ?? null,
        cik: row.cik?.trim() ?? null,
      },
    ])
  );

  return normalizedTickers
    .map((ticker) => byTicker.get(ticker))
    .filter((profile): profile is TickerProfileSummary => profile !== undefined);
}
