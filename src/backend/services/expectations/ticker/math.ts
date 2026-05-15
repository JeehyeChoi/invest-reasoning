export function cagr(
  currentValue: number | null,
  terminalValue: number | null,
  years: number,
): number | null {
  if (
    currentValue === null ||
    terminalValue === null ||
    !Number.isFinite(currentValue) ||
    !Number.isFinite(terminalValue) ||
    currentValue <= 0 ||
    terminalValue <= 0 ||
    years <= 0
  ) {
    return null;
  }

  return Math.pow(terminalValue / currentValue, 1 / years) - 1;
}

export function ratio(
  numerator: number | null,
  denominator: number | null,
): number | null {
  if (
    numerator === null ||
    denominator === null ||
    !Number.isFinite(numerator) ||
    !Number.isFinite(denominator) ||
    denominator <= 0
  ) {
    return null;
  }

  return numerator / denominator;
}

export function multiplyNullable(
  value: number | null,
  multiplier: number | null,
): number | null {
  if (
    value === null ||
    multiplier === null ||
    !Number.isFinite(value) ||
    !Number.isFinite(multiplier)
  ) {
    return null;
  }

  return value * multiplier;
}

export function maxNullable(values: Array<number | null>): number | null {
  const finiteValues = values.filter(
    (value): value is number => value !== null && Number.isFinite(value),
  );
  return finiteValues.length > 0 ? Math.max(...finiteValues) : null;
}

export function averageNullable(values: Array<number | null>): number | null {
  const finiteValues = values.filter(
    (value): value is number => value !== null && Number.isFinite(value),
  );
  if (finiteValues.length === 0) return null;

  return (
    finiteValues.reduce((sum, value) => sum + value, 0) / finiteValues.length
  );
}

export function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

export function toNullableNumber(value: number | string | null): number | null {
  if (value === null) return null;

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function normalizeTicker(ticker: string): string {
  return ticker.trim().toUpperCase();
}

export function toIsoDate(value: Date | string): string {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  return new Date(value).toISOString().slice(0, 10);
}
