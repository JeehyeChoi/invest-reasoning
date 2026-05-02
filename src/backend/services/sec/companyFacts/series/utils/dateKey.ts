export function toDateKey(
  value: string | Date | null | undefined,
): string {
  if (!value) {
    return "";
  }

  if (value instanceof Date) {
    return [
      value.getUTCFullYear(),
      String(value.getUTCMonth() + 1).padStart(2, "0"),
      String(value.getUTCDate()).padStart(2, "0"),
    ].join("-");
  }

  return value.slice(0, 10);
}

export function toDateOnly(
  value: string | Date | null | undefined,
): Date | null {
  const dateKey = toDateKey(value);

  if (!dateKey) {
    return null;
  }

  const [year, month, day] = dateKey.split("-").map(Number);

  if (!year || !month || !day) {
    return null;
  }

  return new Date(Date.UTC(year, month - 1, day));
}

export function requireDateKey(value: string | Date | null | undefined): string {
  const dateKey = toDateKey(value);

  if (!dateKey) {
    throw new Error(`Invalid date value: ${String(value)}`);
  }

  return dateKey;
}

export function toUtcDateMs(
  value: string | Date | null | undefined,
): number | null {
  const dateKey = toDateKey(value);

  if (!dateKey) {
    return null;
  }

  const date = new Date(`${dateKey}T00:00:00.000Z`);
  const ms = date.getTime();

  return Number.isNaN(ms) ? null : ms;
}

export function isSameDate(
  a: string | Date | null | undefined,
  b: string | Date | null | undefined,
): boolean {
  const aKey = toDateKey(a);
  const bKey = toDateKey(b);

  return aKey !== "" && bKey !== "" && aKey === bKey;
}

export function isNextDay(
  previousEnd: string | Date,
  currentStart: string | Date | null,
): boolean {
  if (!currentStart) return false;

  const prev = toUtcDateMs(previousEnd);
  const curr = toUtcDateMs(currentStart);

  if (prev === null || curr === null) return false;

  const dayMs = 1000 * 60 * 60 * 24;
  return curr - prev === dayMs;
}
