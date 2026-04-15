// shared/utils/tickers.ts

export function normalizeTickers(tickers: string[]): string[] {
  return Array.from(
    new Set(
      tickers
        .map((ticker) => ticker.trim().toUpperCase())
        .filter(Boolean)
    )
  );
}

export function normalizeTickerInput(input: unknown): string[] {
  if (!Array.isArray(input)) {
    return [];
  }

  return Array.from(
    new Set(
      input
        .filter((v): v is string => typeof v === "string")
        .map((t) => t.trim().toUpperCase())
        .filter(Boolean)
    )
  );
}
