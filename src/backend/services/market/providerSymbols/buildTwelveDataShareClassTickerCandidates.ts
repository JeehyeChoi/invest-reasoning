const COMPACT_SHARE_CLASS_SUFFIXES = new Set(["A", "B", "C"]);

export function buildTwelveDataShareClassTickerCandidates(
  ticker: string,
): string[] {
  const normalizedTicker = ticker.trim().toUpperCase();

  if (/^[A-Z]{1,4}-[A-Z]$/.test(normalizedTicker)) {
    return [normalizedTicker.replace("-", ".")];
  }

  if (!/^[A-Z]{3,5}$/.test(normalizedTicker)) return [];

  const shareClass = normalizedTicker.at(-1);
  if (!shareClass || !COMPACT_SHARE_CLASS_SUFFIXES.has(shareClass)) return [];

  const baseTicker = normalizedTicker.slice(0, -1);
  if (baseTicker.length < 2 || baseTicker.length > 4) return [];

  return [`${baseTicker}.${shareClass}`];
}
