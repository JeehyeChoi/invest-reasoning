export const UNIVERSE_KEYS = [
  "sp500",
  "sp400",
  "sp600",
  "djia",
  "russell1000",
  "russell2000",
  "russell3000",
  "factor_proxy_etfs",
] as const;

export type UniverseKey = (typeof UNIVERSE_KEYS)[number];

export const DEFAULT_UNIVERSE_KEYS: UniverseKey[] = ["sp500", "sp400"];

export const UNIVERSE_LABELS = {
  sp500: "S&P 500",
  sp400: "S&P 400",
  sp600: "S&P 600",
  djia: "DJIA",
  russell1000: "Russell 1000",
  russell2000: "Russell 2000",
  russell3000: "Russell 3000",
  factor_proxy_etfs: "Factor Proxy ETFs",
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
