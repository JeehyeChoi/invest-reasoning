import {
  averageNullable,
  clamp01,
  maxNullable,
} from "@/backend/services/expectations/ticker/math";

export function buildExpectationBurdenScore(input: {
  impliedRevenueCagr: number | null;
  impliedNetIncomeCagr: number | null;
  terminalOperatingMargin: number | null;
}): number | null {
  const growthBurden = maxNullable([
    normalizeRateBurden(input.impliedRevenueCagr),
    normalizeRateBurden(input.impliedNetIncomeCagr),
  ]);
  const marginBurden = normalizeMarginBurden(input.terminalOperatingMargin);

  return averageNullable([growthBurden, marginBurden]);
}

export function buildValuationFragilityScore(input: {
  currentEvSalesMultiple: number | null;
  currentPeMultiple: number | null;
  terminalEvSalesMultiple: number | null;
  terminalPeMultiple: number | null;
}): number | null {
  const evSalesFragility = normalizeMultipleFragility(
    input.currentEvSalesMultiple,
    input.terminalEvSalesMultiple,
  );
  const peFragility = normalizeMultipleFragility(
    input.currentPeMultiple,
    input.terminalPeMultiple,
  );

  return averageNullable([evSalesFragility, peFragility]);
}

function normalizeRateBurden(value: number | null): number | null {
  if (value === null) return null;
  return clamp01((value - 0.02) / 0.28);
}

function normalizeMarginBurden(value: number | null): number | null {
  if (value === null) return null;
  return clamp01((value - 0.05) / 0.45);
}

function normalizeMultipleFragility(
  currentMultiple: number | null,
  terminalMultiple: number | null,
): number | null {
  if (
    currentMultiple === null ||
    terminalMultiple === null ||
    !Number.isFinite(currentMultiple) ||
    !Number.isFinite(terminalMultiple) ||
    terminalMultiple <= 0
  ) {
    return null;
  }

  return clamp01(currentMultiple / terminalMultiple / 2);
}
