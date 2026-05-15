export const UNIVERSE_KEYS = [
  "sp500",
  "sp400",
  "sp600",
  "djia",
  "factor_proxy_etfs",
  "watchlist",
] as const;

export type UniverseKey = (typeof UNIVERSE_KEYS)[number];

export const DEFAULT_UNIVERSE_KEYS: UniverseKey[] = [
  "sp500",
  "sp400",
  "sp600",
  "watchlist",
];

export const UNIVERSE_LABELS = {
  sp500: "S&P 500",
  sp400: "S&P 400",
  sp600: "S&P 600",
  djia: "DJIA",
  factor_proxy_etfs: "Factor Proxy ETFs",
  watchlist: "Watchlist",
} as const satisfies Record<UniverseKey, string>;

export function isUniverseKey(value: unknown): value is UniverseKey {
  return (
    typeof value === "string" &&
    (UNIVERSE_KEYS as readonly string[]).includes(value)
  );
}

export function normalizeUniverseKeys(
  value: readonly unknown[] | undefined,
): UniverseKey[] {
  const source = value?.length ? value : DEFAULT_UNIVERSE_KEYS;
  const unique = new Set<UniverseKey>();

  for (const key of source) {
    if (isUniverseKey(key)) {
      unique.add(key);
    }
  }

  return unique.size ? [...unique] : [...DEFAULT_UNIVERSE_KEYS];
}
