export const UNIVERSE_KEYS = [
  "sp500",
  "sp400",
  "sp600",
  "djia",
  "russell1000",
  "russell2000",
  "russell3000",
] as const;

export type UniverseKey = (typeof UNIVERSE_KEYS)[number];

export const DEFAULT_UNIVERSE_KEYS: UniverseKey[] = ["sp500"];

export function isUniverseKey(value: unknown): value is UniverseKey {
  return (
    typeof value === "string" &&
    (UNIVERSE_KEYS as readonly string[]).includes(value)
  );
}
