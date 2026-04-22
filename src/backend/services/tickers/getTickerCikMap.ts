import { db } from "@/backend/config/db"; 
import { normalizeTickers } from "@/shared/utils/tickers";

type TickerCikRow = {
  ticker: string;
  cik: string | null;
};

export async function getTickerCikMap(
  tickers: string[],
): Promise<Record<string, string | null>> {
  const normalizedTickers = normalizeTickers(tickers);

  if (normalizedTickers.length === 0) {
    return {};
  }

  const query = `
    SELECT
      ticker,
      cik
    FROM ticker_classifications
    WHERE ticker = ANY($1::text[])
  `;

  const { rows } = await db.query<TickerCikRow>(query, [normalizedTickers]);

  const result: Record<string, string | null> = {};

  for (const ticker of normalizedTickers) {
    result[ticker] = null;
  }

  for (const row of rows) {
    result[row.ticker] = row.cik;
  }

  return result;
}
